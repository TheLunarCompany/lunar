package discovery

import (
	"errors"
	"lunar/aggregation-plugin/common"

	"github.com/rs/zerolog/log"
)

func Run(
	state *State,
	records []common.AccessLog,
	tree common.SimpleURLTreeI,
) error {
	if len(records) == 0 {
		return nil
	}
	combinedAggsToPersist := GetUpdatedAggregations(
		*state.aggregation,
		records,
		tree,
	)

	log.Debug().Msgf("📦 [discovery] Combined: %+v\n", combinedAggsToPersist)

	err := state.UpdateAggregation(&combinedAggsToPersist)
	if err != nil {
		return errors.Join(common.ErrCouldNotDumpCombinedAgg, err)
	}

	return nil
}

func GetUpdatedAggregations(
	aggregation Agg,
	records []common.AccessLog,
	tree common.SimpleURLTreeI,
) Agg {
	accessLogs := []AccessLog{}
	for _, record := range records {
		accessLogs = append(accessLogs, AccessLog(record))
	}

	newAgg := ExtractAggs(accessLogs, tree)
	combinedAgg := CombineAggregation(aggregation, newAgg)

	log.Debug().Msgf("📦 [discovery] Combined: %+v\n", combinedAgg)

	return combinedAgg
}
