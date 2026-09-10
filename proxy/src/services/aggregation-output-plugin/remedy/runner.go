package remedy

import (
	"errors"
	"lunar/aggregation-plugin/common"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/utils"

	"github.com/rs/zerolog/log"
)

func Run(
	state *State,
	records []common.AccessLog,
	tree common.SimpleURLTreeI,
	clock clock.Clock,
) error {
	if len(records) == 0 {
		return nil
	}
	records = filterOutInternalRecords(records)
	combinedAggsToPersist := GetUpdatedAggregations(
		*state.aggregation,
		records,
		tree,
		clock,
	)

	log.Trace().Msgf("📦 [remedy-stats] Combined: %+v\n", combinedAggsToPersist)

	err := state.UpdateAggregation(&combinedAggsToPersist)
	if err != nil {
		return errors.Join(common.ErrCouldNotDumpCombinedAgg, err)
	}

	return nil
}

func GetUpdatedAggregations(
	currentAgg Aggregation,
	records []common.AccessLog,
	tree common.SimpleURLTreeI,
	clock clock.Clock,
) Aggregation {
	accessLogs := []AccessLog{}
	for _, record := range records {
		accessLogs = append(accessLogs, AccessLog(record))
	}
	newAggs := ExtractAggFromBatch(accessLogs, tree, clock)
	combinedAggs := utils.Combine(currentAgg, newAggs)
	return combinedAggs
}

func filterOutInternalRecords(records []common.AccessLog) []common.AccessLog {
	accessLogs := []common.AccessLog{}
	for _, record := range records {
		if !record.Internal {
			accessLogs = append(accessLogs, record)
		}
	}
	return accessLogs
}
