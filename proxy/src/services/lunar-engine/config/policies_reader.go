package config

import (
	"errors"
	"fmt"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/configuration"

	"github.com/go-playground/validator/v10"
	"github.com/rs/zerolog/log"
)

var (
	castingError      = "casting_error"
	supported         = "supported"
	unknownPlugin     = "unknown_plugin"
	invalidPercentage = "invalid_percentage"
	undefinedAccount  = "undefined_account"
	undefinedExporter = "undefined_exporter"
)

func ReadPoliciesConfig(path string) (*sharedConfig.PoliciesConfig, error) {
	config, readErr := configuration.DecodeYAML[sharedConfig.PoliciesConfig](
		path,
	)
	if readErr != nil {
		return nil, readErr
	}

	if validationErr := validate(config); validationErr != nil {
		return nil, validationErr
	}

	return config, nil
}

func validate(config *sharedConfig.PoliciesConfig) error {
	validateErr := sharedConfig.Validate.Struct(config)

	if validateErr != nil {

		if err, ok := validateErr.(*validator.InvalidValidationError); ok {
			return err
		}

		var err error

		if vErrs, ok := validateErr.(validator.ValidationErrors); ok {
			for _, vErr := range vErrs {
				var newErr error
				switch vErr.Tag() {
				case castingError:
					newErr = fmt.Errorf(
						"💔 Failed casting '%s' struct", vErr.StructNamespace(),
					)
				case unknownPlugin:
					newErr = fmt.Errorf(
						"💔 '%s.❓' has an unknown plugin", vErr.StructNamespace(),
					)
				case undefinedExporter:
					newErr = fmt.Errorf(
						"💔 '%s' has a value of '%v' and its an undefined exporter",
						vErr.StructNamespace(), vErr.Value(),
					)
				case undefinedAccount:
					newErr = fmt.Errorf(
						"💔 '%s' has a value of '%v' and its an undefined account",
						vErr.StructNamespace(), vErr.Value(),
					)
				case invalidPercentage:
					newErr = fmt.Errorf(
						"💔 '%s' has a value of '%v' but sum of all quota allocations must be less than or equal to 100", //nolint:lll
						vErr.StructNamespace(), vErr.Value(),
					)
				default:
					newErr = fmt.Errorf(
						"💔 '%s' has a value of '%v' which does not satisfy the '%s' constraint",
						vErr.StructNamespace(), vErr.Value(), vErr.Tag(),
					)
				}
				err = errors.Join(err, newErr)
			}
		}
	}
	var err error
	err = nil
	for _, account := range config.Accounts {
		newErr := account.Authentication.LoadEnvValues()
		if newErr != nil {
			err = errors.Join(err, newErr)
		}
	}

	return err
}

func ValidateStructLevel(structLevel validator.StructLevel) {
	value := structLevel.Current().Interface()

	switch value.(type) {
	case sharedConfig.Remedy:
		validateRemedyTypeDefined(structLevel)
		validateRemedy(structLevel)

	case sharedConfig.Diagnosis:
		validateDiagnosisTypeDefined(structLevel)
		validateExporters(structLevel)
	}
}

func validateRemedyTypeDefined(structLevel validator.StructLevel) {
	remedy, ok := structLevel.Current().Interface().(sharedConfig.Remedy)
	if !ok {
		structLevel.ReportError(remedy, "", "", castingError, "")
		return
	}

	if remedy.IsTypeUndefined() {
		structLevel.ReportError(remedy.Config, "", "", unknownPlugin, "")
	}
}

func validateDiagnosisTypeDefined(structLevel validator.StructLevel) {
	diagnosis, ok := structLevel.Current().Interface().(sharedConfig.Diagnosis)
	if !ok {
		structLevel.ReportError(diagnosis, "", "", castingError, "")
		return
	}

	if diagnosis.IsTypeUndefined() {
		structLevel.ReportError(diagnosis.Config, "", "", unknownPlugin, "")
	}
}

func validateRemedy(structLevel validator.StructLevel) {
	remedyPlugin, ok := structLevel.Current().Interface().(sharedConfig.Remedy)
	if !ok {
		structLevel.ReportError(remedyPlugin, "", "", castingError, "")
		return
	}
	if remedyPlugin.Type() == sharedConfig.RemedyStrategyBasedThrottling {
		config := remedyPlugin.Config.StrategyBasedThrottling
		if config.GroupQuotaAllocation != nil {
			var sum float64
			for _, quota := range config.GroupQuotaAllocation.Groups {
				sum += quota.AllocationPercentage
			}
			sum += config.GroupQuotaAllocation.DefaultAllocationPercentage
			if sum > 100 {
				structLevel.ReportError(config.GroupQuotaAllocation, "", "",
					invalidPercentage, "")
			} else if sum < 100 {
				log.Warn().Msg("Sum of all quota allocations is less than 100")
			}
		}
	}

	if remedyPlugin.Type() == sharedConfig.RemedyAccountOrchestration {
		roundRobin := remedyPlugin.Config.AccountOrchestration.RoundRobin
		policiesConfig, ok := structLevel.Top().Interface().(*sharedConfig.PoliciesConfig) //nolint:lll
		if !ok {
			structLevel.ReportError(policiesConfig, "", "", castingError, "")
			return
		}

		for i, accountName := range roundRobin {
			if _, found := policiesConfig.Accounts[accountName]; !found {
				structLevel.ReportError(
					remedyPlugin.Config.AccountOrchestration.RoundRobin[i],
					"", "", undefinedAccount, "")
			}
		}
	}
}

func validateExporters(structLevel validator.StructLevel) {
	diagnosisPlugin, ok := structLevel.Current().Interface().(sharedConfig.Diagnosis) //nolint
	if !ok {
		structLevel.ReportError(diagnosisPlugin, "", "", castingError, "")
		return
	}

	policiesConfig, ok := structLevel.Top().Interface().(*sharedConfig.PoliciesConfig) //nolint:lll
	if !ok {
		structLevel.ReportError(diagnosisPlugin, "", "", castingError, "")
		return
	}

	isExporterConfigured := isExporterConfigured(diagnosisPlugin,
		policiesConfig.Exporters)
	if !isExporterConfigured {
		structLevel.ReportError(diagnosisPlugin.Export, "", "", undefinedExporter, "") //nolint:lll
	}

	exporterSupported := doesDiagnosisSupportsExporter(diagnosisPlugin)
	if !exporterSupported {
		structLevel.ReportError(diagnosisPlugin.Export, "", "", supported, "")
	}
}

func isExporterConfigured(
	diagnosisPlugin sharedConfig.Diagnosis,
	exporters sharedConfig.Exporters,
) bool {
	res := true
	switch diagnosisPlugin.ExporterType() {
	case sharedConfig.ExporterFile:
		if exporters.File == nil {
			res = false
		}

	case sharedConfig.ExporterS3:
		if exporters.S3 == nil {
			res = false
		}

	case sharedConfig.ExporterS3Minio:
		if exporters.S3Minio == nil {
			res = false
		}

	case sharedConfig.ExporterPrometheus:
	case sharedConfig.ExporterUndefined:
		return false
	}
	return res
}

func doesDiagnosisSupportsExporter(
	diagnosisPlugin sharedConfig.Diagnosis,
) bool {
	exporterKind := diagnosisPlugin.ExporterKind()
	res := false
	switch diagnosisPlugin.Type() {
	case sharedConfig.DiagnosisHARExporter:
		if exporterKind == sharedConfig.ExporterKindRawData {
			res = true
		}
	case sharedConfig.DiagnosisMetricsCollector:
		if exporterKind == sharedConfig.ExporterKindRawData ||
			exporterKind == sharedConfig.ExporterKindMetrics {
			res = true
		}
	case sharedConfig.DiagnosisVoid:
		if exporterKind == sharedConfig.ExporterKindRawData ||
			exporterKind == sharedConfig.ExporterKindMetrics {
			res = true
		}
	case sharedConfig.DiagnosisUndefined:
	}

	return res
}
