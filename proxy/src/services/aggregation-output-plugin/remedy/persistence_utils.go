package remedy

import sharedActions "lunar/shared-model/actions"

func ConvertToPersisted(agg Aggregation) Output {
	outputRemedyStats := []OutputStats{}
	for remedyWithAction, remedyStats := range agg.RemedyStats {
		pEndpointAffectedStats := []OutputEndpointAffectedStats{}
		for endpoint, endpointStats := range remedyStats.AffectedStatsByEndpoint {
			single := OutputEndpointAffectedStats{
				Method:            endpoint.Method,
				URL:               endpoint.URL,
				Count:             endpointStats.Count,
				CountByStatusCode: endpointStats.StatusCodes,
			}
			pEndpointAffectedStats = append(pEndpointAffectedStats, single)
		}
		affectedRatio := float32(
			remedyStats.AffectedCount,
		) / float32(
			agg.TotalCount,
		)
		outputStats := OutputStats{
			Remedy:                  remedyWithAction.Remedy,
			Action:                  remedyWithAction.Action,
			AffectedCount:           remedyStats.AffectedCount,
			AffectedRatio:           affectedRatio,
			AffectedStatsByEndpoint: pEndpointAffectedStats,
		}
		outputRemedyStats = append(outputRemedyStats, outputStats)
	}

	outputRemedyActionStats := map[Action]OutputActionStats{}
	for action, actionStats := range agg.RemedyActionStats {
		pStatusCodes := map[string]float32{}
		for statusCode, count := range actionStats.StatusCodes {
			pStatusCodes[statusCode] = float32(count) / float32(agg.TotalCount)
		}
		ratio := float32(actionStats.Count) / float32(agg.TotalCount)
		outputActionStats := OutputActionStats{
			Count:             actionStats.Count,
			Ratio:             ratio,
			RatioByStatusCode: pStatusCodes,
		}
		outputRemedyActionStats[action] = outputActionStats
	}

	return Output{
		RemedyStats:       outputRemedyStats,
		RemedyActionStats: outputRemedyActionStats,
		MaxTime: sharedActions.TimestampToStringFromInt64(
			agg.MaxEpochMillis),
		MinTime: sharedActions.TimestampToStringFromInt64(
			agg.MinEpochMillis),
	}
}
