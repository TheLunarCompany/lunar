package discovery

import (
	"errors"
	"lunar/aggregation-plugin/common"

	"github.com/rs/zerolog/log"
)

func Run(
	state *State,
	apiCallsState *APICallsState,
	records []common.AccessLog,
	tree common.SimpleURLTreeI,
) error {
	if len(records) == 0 {
		return nil
	}
	accessLogs := filterOutInternalRecords(records)

	combinedAggsToPersist, err := GetUpdatedAggregations(
		*state.aggregation,
		accessLogs,
		tree,
	)
	if err != nil {
		log.Error().Stack().Err(err).Msg("🛑 Failed to update aggregations")
		return err
	}

	log.Trace().Msgf("📦 [discovery] Combined: %+v\n", combinedAggsToPersist)

	err = state.UpdateAggregation(&combinedAggsToPersist)
	if err != nil {
		return errors.Join(common.ErrCouldNotDumpCombinedAgg, err)
	}

	if common.IsFlowsEnabled() {
		UpdateAPICallsMetrics(apiCallsState.apiCallMetricsState, accessLogs)
		log.Trace().Msgf("Updated API calls metrics: %+v", apiCallsState.apiCallMetricsState)

		err = apiCallsState.UpdateState()
		if err != nil {
			return errors.Join(errors.New("could not dump API calls metrics"), err)
		}
	}

	return nil
}

func UpdateAPICallsMetrics(apiCallsMetrics *APICallMetricData, accessLogs []AccessLog) {
	for _, log := range accessLogs {
		apiCallsMetrics.UpdateMetric(log)
	}
}

func GetUpdatedAggregations(
	aggregation Agg,
	accessLogs []AccessLog,
	tree common.SimpleURLTreeI,
) (Agg, error) {
	aggregation, err := ConvergeAggregation(aggregation, accessLogs, tree)
	if err != nil {
		return aggregation, err
	}

	newAgg := ExtractAggs(accessLogs, tree)
	combinedAgg := CombineAggregation(aggregation, newAgg)

	log.Trace().Msgf("📦 [discovery] Combined: %+v\n", combinedAgg)

	return combinedAgg, nil
}

func filterOutInternalRecords(records []common.AccessLog) []AccessLog {
	accessLogs := []AccessLog{}
	for _, record := range records {
		if !record.Internal {
			accessLogs = append(accessLogs, AccessLog(record))
		}
	}
	return accessLogs
}
