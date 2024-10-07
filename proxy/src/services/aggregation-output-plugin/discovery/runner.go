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
	combinedAggsToPersist, err := GetUpdatedAggregations(
		*state.aggregation,
		records,
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

	return nil
}

func GetUpdatedAggregations(
	aggregation Agg,
	records []common.AccessLog,
	tree common.SimpleURLTreeI,
) (Agg, error) {
	accessLogs := []AccessLog{}
	for _, record := range records {
		if !record.Internal {
			accessLogs = append(accessLogs, AccessLog(record))
		}
	}

	aggregation, err := ConvergeAggregation(aggregation, accessLogs, tree)
	if err != nil {
		return aggregation, err
	}

	newAgg := ExtractAggs(accessLogs, tree)
	combinedAgg := CombineAggregation(aggregation, newAgg)

	log.Trace().Msgf("📦 [discovery] Combined: %+v\n", combinedAgg)

	return combinedAgg, nil
}
