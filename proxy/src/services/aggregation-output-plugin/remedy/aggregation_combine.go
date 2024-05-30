package remedy

import (
	"lunar/aggregation-plugin/common"
	"lunar/aggregation-plugin/utils"

	"github.com/samber/lo"
)

func (a Int) Combine(b Int) Int {
	return a + b
}

func (a Aggregation) Combine(b Aggregation) Aggregation { //nolint:varnamelen
	totalCount := utils.Combine(a.TotalCount, b.TotalCount)
	// minEpoch needs to disregard the default zero value
	minEpoch := lo.Min(
		lo.Filter(
			[]int64{a.MinEpochMillis, b.MinEpochMillis},
			func(epoch int64, _ int) bool { return epoch != 0 },
		),
	)
	maxEpoch := lo.Max([]int64{a.MaxEpochMillis, b.MaxEpochMillis})
	combined := Aggregation{
		RemedyStats: utils.Combine[utils.Map[RemedyWithAction, RemedyStats]](
			a.RemedyStats,
			b.RemedyStats,
		),
		RemedyActionStats: utils.Combine[utils.Map[Action, CounterWithStatusCodes]](
			a.RemedyActionStats,
			b.RemedyActionStats,
		),
		TotalCount:     totalCount,
		MinEpochMillis: minEpoch,
		MaxEpochMillis: maxEpoch,
	}

	return combined
}

func (a RemedyStats) Combine(b RemedyStats) RemedyStats {
	affectedCount := utils.Combine(a.AffectedCount, b.AffectedCount)
	affectedStatsByEndpoint := utils.Combine[utils.Map[common.Endpoint, CounterWithStatusCodes]](
		a.AffectedStatsByEndpoint,
		b.AffectedStatsByEndpoint,
	)
	return RemedyStats{
		AffectedCount:           affectedCount,
		AffectedStatsByEndpoint: affectedStatsByEndpoint,
	}
}

func (a CounterWithStatusCodes) Combine(
	b CounterWithStatusCodes, //nolint:varnamelen
) CounterWithStatusCodes {
	return CounterWithStatusCodes{
		Count: utils.Combine(a.Count, b.Count),
		StatusCodes: utils.Combine[utils.Map[string, Int]](
			a.StatusCodes,
			b.StatusCodes,
		),
	}
}
