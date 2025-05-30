package quotaresource

import (
	streamconfig "lunar/engine/streams/config"
	"lunar/toolkit-core/configuration"
	"time"
)

// This function is used to convert the QuotaResourceData to a list of SingleQuotaResourceData
// Will help in processing the data to keep the original convention with minimal changes.
func (qc *QuotaResourceData) ToSingleQuotaResourceDataList() []*SingleQuotaResourceData {
	singleQuotaResourceDataList := []*SingleQuotaResourceData{}

	for _, quota := range qc.Quotas {
		temporaryParentIDs := map[string]struct{}{}
		temporaryParentIDs[quota.ID] = struct{}{}
		singleData := &SingleQuotaResourceData{
			Quota:          quota,
			InternalLimits: make([]*ChildQuotaConfig, 0),
		}

		for _, internalLimit := range qc.InternalLimits {
			if _, found := temporaryParentIDs[internalLimit.ParentID]; !found {
				continue
			}
			temporaryParentIDs[internalLimit.QuotaConfig.ID] = struct{}{}
			singleData.InternalLimits = append(singleData.InternalLimits, internalLimit)
		}
		singleQuotaResourceDataList = append(singleQuotaResourceDataList, singleData)
	}

	return singleQuotaResourceDataList
}

func (q *QuotaMetaData) GetID() string {
	return q.ID
}

func (q *QuotaMetaData) GetFilter() *streamconfig.Filter {
	return q.Filter
}

func (q *QuotaMetaData) GetStrategy() *StrategyConfig {
	return q.Strategy
}

func (mrd *MonthlyRenewalData) getMonthlyResetIn() (time.Time, error) {
	loc, err := time.LoadLocation(mrd.Timezone)
	if err != nil {
		return time.Time{}, err
	}

	now := time.Now().In(loc)
	nextReset := now.AddDate(0, 1, mrd.Day-1).
		Add(time.Duration(mrd.Hour) * time.Hour).
		Add(time.Duration(mrd.Minute) * time.Minute)

	return nextReset, nil
}

// This function is used to assign the effective quota limit for a child quota based on its
// PercentageAllocation value. It will inherit and assign the quota strategy from the parent
// and will update the quota limit based on the percentage.
// Only applicable for FixedWindow and FixedWindowCustomCounter strategies at the moment.
func AssignQuotaLimitForPercentageAllocation(
	childStrategyConfig *StrategyConfig,
	parentStrategyConfig *StrategyConfig,
) error {
	// We begin with keeping value of the allocation percentage
	percentage := childStrategyConfig.AllocationPercentage
	if percentage == 0 {
		return nil
	}

	// Next, we prepare a copy of the parent strategy config which
	// we could mutate without affecting the parent
	parentCopy, err := configuration.YAMLBasedDeepCopy(parentStrategyConfig)
	if err != nil {
		return err
	}

	// Lastly, we replace in-place for the relevant strategy
	// and update the quota limit based on the percentage
	switch parentCopy.GetUsedStrategy() { //nolint: exhaustive
	case FixedWindowStrategy:
		childStrategyConfig.FixedWindow = parentCopy.FixedWindow
		childStrategyConfig.AllocationPercentage = 0
		updatedMax := (childStrategyConfig.FixedWindow.Max * percentage) / 100
		childStrategyConfig.FixedWindow.Max = updatedMax
	case FixedWindowCustomCounterStrategy:
		childStrategyConfig.FixedWindowCustomCounter = parentCopy.FixedWindowCustomCounter
		childStrategyConfig.AllocationPercentage = 0
		updatedMax := (childStrategyConfig.FixedWindowCustomCounter.Max * percentage) / 100
		childStrategyConfig.FixedWindowCustomCounter.Max = updatedMax
	default:
	}
	return nil
}
