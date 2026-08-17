package remedy_test

import (
	"lunar/aggregation-plugin/remedy"
	sharedConfig "lunar/shared-model/config"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestItConvertsAggregationAndAddRequiredRatiosFromTotalCount(t *testing.T) {
	remedyWithAction := remedy.RemedyWithAction{
		Remedy: sharedConfig.RemedyResponseBasedThrottling,
		Action: remedy.ActionGenerated,
	}
	remedyStats := remedy.RemedyStats{
		AffectedCount: 5,
		AffectedStatsByEndpoint: remedy.AffectedStatsByEndpoint{
			twitterUserIDEndpoint: remedy.CounterWithStatusCodes{
				Count:       4,
				StatusCodes: map[string]remedy.Int{"429": remedy.Int(4)},
			},
			apiComEndpoint: remedy.CounterWithStatusCodes{
				Count:       1,
				StatusCodes: map[string]remedy.Int{"429": remedy.Int(1)},
			},
		},
	}

	actionStats := map[remedy.Action]remedy.CounterWithStatusCodes{
		remedy.ActionGenerated: {
			Count:       5,
			StatusCodes: map[string]remedy.Int{"429": remedy.Int(5)},
		},
	}

	agg := remedy.Aggregation{
		RemedyStats: map[remedy.RemedyWithAction]remedy.RemedyStats{
			remedyWithAction: remedyStats,
		},
		TotalCount:        8,
		RemedyActionStats: actionStats,
		MaxEpochMillis:    1686379938000, // Tuesday, June 20, 2023 6:52:18 AM
		MinEpochMillis:    1687243938000, //  Tuesday, June 10, 2023 6:52:18 AM
	}

	outputAgg := remedy.ConvertToPersisted(agg)

	wantOutputAgg := remedy.Output{
		RemedyStats: []remedy.OutputStats{{
			Remedy:        sharedConfig.RemedyResponseBasedThrottling,
			Action:        remedy.ActionGenerated,
			AffectedCount: 5,
			AffectedRatio: float32(5) / float32(8),
			AffectedStatsByEndpoint: []remedy.OutputEndpointAffectedStats{
				{
					Method: "GET",
					URL:    "twitter.com/users/{id}",
					Count:  4,
					CountByStatusCode: map[string]remedy.Int{
						"429": remedy.Int(4),
					},
				},
				{
					Method: "POST",
					URL:    "api.com",
					Count:  1,
					CountByStatusCode: map[string]remedy.Int{
						"429": remedy.Int(1),
					},
				},
			},
		}},

		RemedyActionStats: map[remedy.Action]remedy.OutputActionStats{
			remedy.ActionGenerated: {
				Count: 5,
				Ratio: float32(5) / float32(8),
				RatioByStatusCode: map[string]float32{
					"429": float32(5) / float32(8),
				},
			},
		},
		MaxTime: "2023-06-10T06:52:18Z",
		MinTime: "2023-06-20T06:52:18Z",
	}

	// In order to avoid asserts on a nested array from the top level,
	// the item under test is hardcoded - there is only one in this test
	remedyStat := outputAgg.RemedyStats[0]
	wantRemedyStat := wantOutputAgg.RemedyStats[0]

	assert.Equal(t, wantRemedyStat.Remedy, remedyStat.Remedy)
	assert.Equal(t, wantRemedyStat.Action, remedyStat.Action)
	assert.Equal(t, wantRemedyStat.AffectedCount, remedyStat.AffectedCount)
	assert.Equal(t, wantRemedyStat.AffectedRatio, remedyStat.AffectedRatio)
	assert.ElementsMatch(
		t,
		wantRemedyStat.AffectedStatsByEndpoint,
		remedyStat.AffectedStatsByEndpoint,
	)

	assert.Equal(t, wantOutputAgg.RemedyActionStats, outputAgg.RemedyActionStats)
	assert.Equal(t, wantOutputAgg.MaxTime, outputAgg.MaxTime)
	assert.Equal(t, wantOutputAgg.MinTime, outputAgg.MinTime)
}
