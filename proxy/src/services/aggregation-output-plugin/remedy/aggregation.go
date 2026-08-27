package remedy

import (
	"fmt"
	"lunar/aggregation-plugin/common"
	sharedDiscovery "lunar/shared-model/discovery"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/utils"
)

func ExtractAggFromBatch(
	records []AccessLog,
	tree common.SimpleURLTreeI,
	clock clock.Clock,
) Aggregation {
	agg := Aggregation{} //nolint: exhaustruct
	for _, accessLog := range records {
		accessLogAgg := extractAggFromSingle(accessLog, tree, clock)
		agg = utils.Combine[Aggregation](agg, accessLogAgg)
	}

	return agg
}

// This implementation assumes that for a single accessLog,
// a specific RemedyWithAction may only appear once
func extractAggFromSingle(
	accessLog AccessLog,
	tree common.SimpleURLTreeI,
	clock clock.Clock,
) Aggregation {
	statsByRemedy := map[RemedyWithAction]RemedyStats{}

	remedyWithActions := accessLog.extractRemedyWithActions()
	for _, remedyWithAction := range remedyWithActions {
		if remedyWithAction.Action == ActionNoOp {
			continue
		}

		endpoint := accessLogToEndpoint(tree)(accessLog)
		statusCodes := map[string]Int{fmt.Sprint(accessLog.StatusCode): Int(1)}
		affectedStatsByEndpoint := AffectedStatsByEndpoint{
			endpoint: CounterWithStatusCodes{
				Count:       1,
				StatusCodes: statusCodes,
			},
		}

		statsByRemedy[remedyWithAction] = RemedyStats{
			AffectedCount:           Int(1),
			AffectedStatsByEndpoint: affectedStatsByEndpoint,
		}
	}

	statsByAction := map[Action]CounterWithStatusCodes{}
	for _, action := range accessLog.extractActions() {
		if action == ActionNoOp {
			continue
		}
		actionStats := CounterWithStatusCodes{
			Count: Int(1),
			StatusCodes: map[string]Int{
				fmt.Sprint(accessLog.StatusCode): Int(1),
			},
		}
		statsByAction[action] = actionStats
	}

	return Aggregation{
		RemedyStats:       statsByRemedy,
		RemedyActionStats: statsByAction,
		TotalCount:        Int(1),
		MinEpochMillis:    clock.Now().UnixMilli(),
		MaxEpochMillis:    clock.Now().UnixMilli(),
	}
}

func accessLogToEndpoint(
	tree common.SimpleURLTreeI,
) func(AccessLog) sharedDiscovery.Endpoint {
	return func(accessLog AccessLog) sharedDiscovery.Endpoint {
		normalizedAccessLog, match := common.StrictNormalizeURL(
			tree,
			accessLog.URL,
		)
		if !match {
			normalizedAccessLog = accessLog.Host
		}
		return sharedDiscovery.Endpoint{
			Method: accessLog.Method,
			URL:    normalizedAccessLog,
		}
	}
}
