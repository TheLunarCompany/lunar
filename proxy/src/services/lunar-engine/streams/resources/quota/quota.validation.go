package quotaresource

import (
	"errors"
	"fmt"
	"lunar/engine/utils"

	"github.com/go-playground/validator/v10"
)

type quotaProviderValidator struct {
	fileToHostDictionary map[string]string // host-to-file path
	hostToFileDictionary map[string]string // file path-to-host
}

func (qr *QuotaResourceData) Validate() error {
	var errMsg error
	validate := validator.New()
	singleQuotaDataList := qr.ToSingleQuotaResourceDataList()
	for _, singleQuotaData := range singleQuotaDataList {
		validationErr := validate.Struct(qr)
		if validationErr != nil {
			if err, ok := validationErr.(*validator.InvalidValidationError); ok {
				return err
			}
			for _, err := range validationErr.(validator.ValidationErrors) {
				errMsg = errors.Join(errMsg,
					fmt.Errorf("validation error: %s, at quotaID: %s, error: %s. ",
						err.StructNamespace(),
						singleQuotaData.Quota.ID,
						tagTranslation(err.Tag(), err.Param()),
					),
				)
			}
			return errMsg
		}
		if err := singleQuotaData.validateFilters(); err != nil {
			return err
		}

		if !singleQuotaData.specificValidation() {
			return errors.New("validation error: MonthlyRenewal is required for limit with Spillover")
		}
	}
	return nil
}

func tagTranslation(tag string, fieldValue string) string {
	switch tag {
	case "required":
		return "Field is required"
	case "oneof":
		return fmt.Sprintf("Field must be one of %s", fieldValue)
	case "gt":
		return fmt.Sprintf("Field must be greater than %s", fieldValue)
	case "gte":
		return fmt.Sprintf("Field must be greater than or equal to %s", fieldValue)
	case "lte":
		return fmt.Sprintf("Field must be less than or equal to %s", fieldValue)
	default:
		return fmt.Sprintf("Field does not meet %s=%s requirement", tag, fieldValue)
	}
}

func (qr *SingleQuotaResourceData) validateFilters() error {
	if qr.Quota.Filter == nil {
		return fmt.Errorf("validation error: Filter is required for quota '%s'", qr.Quota.ID)
	}
	return nil
}

func (qr *SingleQuotaResourceData) specificValidation() bool {
	shouldHaveMonthlyRenewal := qr.shouldHaveMonthlyRenewal()
	if !shouldHaveMonthlyRenewal {
		return true
	}

	if qr.Quota.Strategy.FixedWindow != nil {
		isMonthlyRenewalSet := qr.Quota.Strategy.FixedWindow.IsMonthlyRenewalSet()
		if !isMonthlyRenewalSet {
			return !shouldHaveMonthlyRenewal
		}
		return shouldHaveMonthlyRenewal
	}

	return true
}

func (qr *SingleQuotaResourceData) shouldHaveMonthlyRenewal() bool {
	shouldHaveMonthlyRenewal := false
	if qr.Quota.Strategy.FixedWindow != nil {
		shouldHaveMonthlyRenewal = qr.Quota.Strategy.FixedWindow.shouldHaveMonthlyRenewal()
	}
	for _, il := range qr.InternalLimits {
		if il.Strategy.FixedWindow == nil {
			continue
		}
		shouldHaveMonthlyRenewal = shouldHaveMonthlyRenewal ||
			il.Strategy.FixedWindow.shouldHaveMonthlyRenewal()
	}

	return shouldHaveMonthlyRenewal
}

func (fw *FixedWindowConfig) shouldHaveMonthlyRenewal() bool {
	return fw.Spillover != nil
}

func newQuotaProviderValidator() *quotaProviderValidator {
	return &quotaProviderValidator{
		fileToHostDictionary: make(map[string]string),
		hostToFileDictionary: make(map[string]string),
	}
}

func (fvd *quotaProviderValidator) Validate(quotaData *QuotaResourceData, filePath string) error {
	if quotaData == nil {
		return nil
	}

	validateHost := func(url string) error {
		quotaHost := utils.ExtractHost(url)

		if host, ok := fvd.fileToHostDictionary[filePath]; ok && host != quotaHost {
			return fmt.Errorf("quota configuration error: multiple hosts detected in the file '%s'. "+
				"Please ensure each file contains a single host configuration", filePath)
		} else if usedFile, ok := fvd.hostToFileDictionary[quotaHost]; ok && usedFile != filePath {
			return fmt.Errorf("quota configuration error: multiple files detected for the host '%s'. "+
				"Please ensure each host is configured in a single file", quotaHost)
		}

		fvd.fileToHostDictionary[filePath] = quotaHost
		fvd.hostToFileDictionary[quotaHost] = filePath
		return nil
	}

	for _, quota := range quotaData.Quotas {
		if quota == nil || quota.Filter == nil {
			continue
		}

		for _, url := range quota.Filter.URLs {
			if err := validateHost(url); err != nil {
				return err
			}
		}

		for _, internal := range quotaData.InternalLimits {
			if internal == nil || internal.Filter == nil || len(internal.Filter.URLs) == 0 {
				continue
			}

			for _, url := range internal.Filter.URLs {
				if err := validateHost(url); err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func (fvd *quotaProviderValidator) CleanValidationData() {
	fvd.fileToHostDictionary = make(map[string]string)
	fvd.hostToFileDictionary = make(map[string]string)
}
