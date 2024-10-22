package quotaresource

import (
	"errors"
	"fmt"

	"github.com/go-playground/validator/v10"
)

func (qr *QuotaResourceData) Validate() error {
	var errMsg error
	validate := validator.New()

	validationErr := validate.Struct(qr)
	if validationErr != nil {
		if err, ok := validationErr.(*validator.InvalidValidationError); ok {
			return err
		}
		for _, err := range validationErr.(validator.ValidationErrors) {
			errMsg = errors.Join(errMsg,
				fmt.Errorf("validation error: %s, at quotaID: %s, error: %s. ",
					err.StructNamespace(),
					qr.Quota.ID,
					tagTranslation(err.Tag(), err.Param()),
				),
			)
		}
		return errMsg
	}

	if err := qr.validateFilters(); err != nil {
		return err
	}

	if !qr.specificValidation() {
		return errors.New("validation error: MonthlyRenewal is required for limit with Spillover")
	}

	if qr.isPercentageInUse() {
		if err := qr.isPercentageValid(); err != nil {
			return err
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

func (qr *QuotaResourceData) validateFilters() error {
	if qr.Quota.Filter == nil {
		return fmt.Errorf("validation error: Filter is required for quota '%s'", qr.Quota.ID)
	}
	return nil
}

func (qr *QuotaResourceData) isPercentageInUse() bool {
	if len(qr.InternalLimits) > 0 {
		for _, limit := range qr.InternalLimits {
			if limit.Strategy.AllocationPercentage != 0 {
				return true
			}
		}
	}
	return false
}

func (qr *QuotaResourceData) isPercentageValid() error {
	var percentageSum int64
	percentageSum = 0
	for _, limit := range qr.InternalLimits {
		if limit.Strategy.AllocationPercentage != 0 {
			percentageSum += limit.Strategy.AllocationPercentage
			if percentageSum > 100 || percentageSum < 1 {
				return fmt.Errorf("validation error: allocation_percentage sum can only be set to 1-100")
			}
		} else {
			// TODO: once we allow more than one strategy, remove this log
			return fmt.Errorf("please use one type of strategy for all internal limits")
		}
	}

	return nil
}

func (qr *QuotaResourceData) specificValidation() bool {
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

func (qr *QuotaResourceData) shouldHaveMonthlyRenewal() bool {
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
