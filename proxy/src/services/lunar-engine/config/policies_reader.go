package config

import (
	"errors"
	"fmt"
	"lunar/engine/utils/environment"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/configuration"
	"lunar/toolkit-core/logic"
	"lunar/toolkit-core/urltree"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"

	"github.com/samber/lo"
)

var (
	castingError        = "casting_error"
	supported           = "supported"
	unknownPlugin       = "unknown_plugin"
	undefinedAccount    = "undefined_account"
	undefinedExporter   = "undefined_exporter"
	duplicatePolicyName = "duplicate_policy_name"
	misalignedWindows   = "misaligned_windows"
	missingPathParam    = "missing_path_param"
)

func ReadPoliciesConfig(path string) (*sharedConfig.PoliciesConfig, error) {
	config, readErr := configuration.DecodeYAML[sharedConfig.PoliciesConfig](
		path,
	)
	if readErr != nil {
		return nil, readErr
	}

	if err := Validate(config); err != nil {
		return nil, err
	}

	return config, nil
}

func Validate(config *sharedConfig.PoliciesConfig) error {
	return ValidateWithDebugLevel(config, environment.IsLogLevelDebug())
}

func ValidateWithDebugLevel(
	config *sharedConfig.PoliciesConfig, isDebugLevel bool,
) error {
	validateErr := sharedConfig.Validate.Struct(*config)
	var err error

	if validateErr != nil {
		if err, ok := validateErr.(*validator.InvalidValidationError); ok {
			return err
		}

		source := "💔 Policies configuration"
		if vErrs, ok := validateErr.(validator.ValidationErrors); ok {
			for _, vErr := range vErrs {
				if isDebugLevel {
					source = fmt.Sprintf("'%s'", vErr.StructNamespace())
				}

				var newErr error
				switch vErr.Tag() {
				case castingError:
					newErr = fmt.Errorf(
						"💔 Failed casting '%s' struct (%v)",
						vErr.StructNamespace(),
						vErr.Value(),
					)
				case unknownPlugin:
					newErr = fmt.Errorf(
						"%s has an unknown plugin",
						source,
					)
				case undefinedExporter:
					newErr = fmt.Errorf(
						"%s has a value of '%v' and it's an undefined exporter",
						source,
						vErr.Value(),
					)
				case undefinedAccount:
					newErr = fmt.Errorf(
						"%s has a value of '%v' and it's an undefined account",
						source,
						vErr.Value(),
					)
				case duplicatePolicyName:
					newErr = fmt.Errorf(
						"%s has duplicate policy names: '%v'",
						source,
						vErr.Value(),
					)
				case misalignedWindows:
					if !isDebugLevel {
						source = "💔 Throttling configuration"
					}
					newErr = fmt.Errorf(
						"%s has misaligned window sizes: '%v'",
						source,
						vErr.Value(),
					)

				default:
					newErr = fmt.Errorf(
						"💔 '%s' has a value of '%v' which does not satisfy the '%s' constraint",
						vErr.StructNamespace(),
						vErr.Value(),
						vErr.Tag(),
					)
				}
				err = errors.Join(err, newErr)
			}
		}
	}
	for _, account := range config.Accounts {
		newErr := account.Authentication.LoadEnvValues()
		if newErr != nil {
			err = errors.Join(err, newErr)
		}
	}

	return err
}

func ValidateInt(fl validator.FieldLevel) bool {
	// Get the field value
	value := fl.Field().Interface()

	var res bool
	// Check if the value is an integer
	switch reflect.TypeOf(value).Kind() { //nolint:exhaustive
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		res = true
	case reflect.Float32, reflect.Float64:
		// Check if the float value is a whole number
		floatValue := reflect.ValueOf(value).Float()
		res = floatValue == float64(int64(floatValue))
	default:
		res = false
	}

	return res
}

func ValidateStructLevel(structLevel validator.StructLevel) {
	value := structLevel.Current().Interface()
	switch value.(type) {
	case sharedConfig.Remedy:
		validateRemedyTypeDefined(structLevel)
		validateRemedy(structLevel)
		validateCachePlugin(structLevel)
	case sharedConfig.Diagnosis:
		validateDiagnosisTypeDefined(structLevel)
		validateExporters(structLevel)
	case sharedConfig.PoliciesConfig:
		validateUniquePolicyNames(structLevel)
		validateStrategyBasedThrottlingChains(structLevel)
	default:
		return
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

	if remedyPlugin.Type() == sharedConfig.RemedyAccountOrchestration {
		roundRobin := remedyPlugin.Config.AccountOrchestration.RoundRobin
		policiesConfig, ok := structLevel.Top().Interface().(sharedConfig.PoliciesConfig) //nolint:lll
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

	// todo add validation for caching in global -> not allowed
}

func validateExporters(structLevel validator.StructLevel) {
	diagnosisPlugin, ok := structLevel.Current().Interface().(sharedConfig.Diagnosis) //nolint
	if !ok {
		structLevel.ReportError(diagnosisPlugin, "", "", castingError, "")
		return
	}

	policiesConfig, ok := structLevel.Top().Interface().(sharedConfig.PoliciesConfig) //nolint:lll
	if !ok {
		structLevel.ReportError(diagnosisPlugin, "", "", castingError, "")
		return
	}

	isExporterConfigured := isExporterConfigured(diagnosisPlugin,
		policiesConfig.Exporters)
	if !isExporterConfigured {
		structLevel.ReportError(
			diagnosisPlugin.Export,
			"",
			"",
			undefinedExporter,
			"",
		)
	}

	exporterSupported := doesDiagnosisSupportsExporter(diagnosisPlugin)
	if !exporterSupported {
		structLevel.ReportError(diagnosisPlugin.Export, "", "", supported, "")
	}
}

func validateUniquePolicyNames(structLevel validator.StructLevel) {
	policiesConfig, ok := structLevel.Current().Interface().(sharedConfig.PoliciesConfig) //nolint
	if !ok {
		structLevel.ReportError(policiesConfig, "", "", castingError, "")
		return
	}

	allPolicyNames := extractAllPolicyNames(policiesConfig)
	duplicatePolicyNames := lo.FindDuplicates(allPolicyNames)

	if len(duplicatePolicyNames) > 0 {
		structLevel.ReportError(
			duplicatePolicyNames,
			"",
			"",
			duplicatePolicyName,
			"",
		)
	}
}

func validateStrategyBasedThrottlingChains(structLevel validator.StructLevel) {
	policiesConfig, ok := structLevel.Current().Interface().(sharedConfig.PoliciesConfig) //nolint
	if !ok {
		structLevel.ReportError(policiesConfig, "", "", castingError, "")
		return
	}

	allRemedyChains := extractAllRemedyChains(policiesConfig)
	for index, chain := range allRemedyChains {
		windowSizes := []int{}
		for _, remedy := range chain {
			if remedy.Config.StrategyBasedThrottling != nil {
				windowSizes = append(
					windowSizes,
					remedy.Config.StrategyBasedThrottling.WindowSizeInSeconds,
				)
			}
		}

		if len(windowSizes) > 0 && !logic.HasCommonDenominator(windowSizes) {
			structLevel.ReportError(
				allRemedyChains[index],
				"",
				"",
				misalignedWindows,
				"",
			)
		}
	}
}

func validateCachePlugin(structLevel validator.StructLevel) {
	remedyPlugin, ok := structLevel.Current().Interface().(sharedConfig.Remedy)
	if !ok {
		structLevel.ReportError(remedyPlugin, "", "", castingError, "")
		return
	}

	if remedyPlugin.Type() != sharedConfig.RemedyCaching {
		return
	}

	endpointConfig, endpointConfigConverted := structLevel.Parent().Interface().(sharedConfig.EndpointConfig) //nolint
	if !endpointConfigConverted {
		structLevel.ReportError(remedyPlugin, "", "", castingError, "")
		return
	}
	urlValue := endpointConfig.URL

	// Split the URL into its path components
	urlComponents := strings.Split(urlValue, "/")

	// Get required path params
	setPathParams := extractPathParams(*remedyPlugin.Config.Caching)

	pathParamsInURLCount := 0

	for _, component := range urlComponents {
		pathParam, ok := urltree.TryExtractPathParameter(component)
		if ok {
			pathParamsInURLCount++
			_, pathParamFound := setPathParams[pathParam]
			if !pathParamFound {
				structLevel.ReportError(
					remedyPlugin,
					"",
					"",
					missingPathParam,
					"",
				)

				return
			}
		}
	}
	if pathParamsInURLCount != len(setPathParams) {
		structLevel.ReportError(remedyPlugin, "", "", missingPathParam, "")
		return
	}
}

func extractPathParams(
	cachingConfig sharedConfig.CachingConfig,
) map[string]any {
	pathParams := make(map[string]any)

	for _, payloadPath := range cachingConfig.RequestPayloadPaths {
		if payloadPath.PayloadType == sharedConfig.PayloadRequestPathParams.String() {
			pathParams[payloadPath.Path] = nil
		}
	}

	return pathParams
}

func extractAllRemedyChains(
	policiesConfig sharedConfig.PoliciesConfig,
) [][]sharedConfig.Remedy {
	// Every endpoint-specific chain is appended with all global remedies
	chains := lo.Map(
		policiesConfig.Endpoints,
		func(item sharedConfig.EndpointConfig, _ int) []sharedConfig.Remedy {
			return append(item.Remedies, policiesConfig.Global.Remedies...)
		},
	)

	// If present, global remedies are also a chain on their own
	if len(policiesConfig.Global.Remedies) > 0 {
		chains = append(chains, policiesConfig.Global.Remedies)
	}
	return chains
}

func extractAllPolicyNames(
	policiesConfig sharedConfig.PoliciesConfig,
) []string {
	globalDiagnosis := lo.Map(
		policiesConfig.Global.Diagnosis,
		func(item sharedConfig.Diagnosis, index int) string { return item.Name },
	)

	globalRemedies := lo.Map(
		policiesConfig.Global.Remedies,
		func(item sharedConfig.Remedy, index int) string { return item.Name },
	)

	endpointDiagnosis := lo.Map(
		lo.FlatMap(
			policiesConfig.Endpoints,
			func(item sharedConfig.EndpointConfig, _ int) []sharedConfig.Diagnosis {
				return item.Diagnosis
			},
		),
		func(item sharedConfig.Diagnosis, _ int) string { return item.Name },
	)

	endpointRemedies := lo.Map(
		lo.FlatMap(
			policiesConfig.Endpoints,
			func(item sharedConfig.EndpointConfig, _ int) []sharedConfig.Remedy {
				return item.Remedies
			},
		),
		func(item sharedConfig.Remedy, _ int) string { return item.Name },
	)

	return append(
		append(append(globalDiagnosis, globalRemedies...), endpointRemedies...),
		endpointDiagnosis...)
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
