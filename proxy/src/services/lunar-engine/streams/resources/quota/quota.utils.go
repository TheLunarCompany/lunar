package quotaresource

import (
	streamconfig "lunar/engine/streams/config"
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

func (s *StrategyConfig) TranslatePercentageToFixedWindow(
	limit int64, interval int64, unit string,
) {
	percentage := s.AllocationPercentage

	fixed := &FixedWindowConfig{
		QuotaLimit: QuotaLimit{
			Max:          (limit * percentage) / 100,
			Interval:     interval,
			IntervalUnit: unit,
		},
	}
	s.FixedWindow = fixed
}
