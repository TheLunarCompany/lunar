package discovery

import (
	"errors"
	"fmt"
	"lunar/aggregation-plugin/common"
	shared_discovery "lunar/shared-model/discovery"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/rs/zerolog/log"
)

var engineAdminPort = os.Getenv("ENGINE_ADMIN_PORT")

func Run(
	state *State,
	records []common.AccessLog,
	tree common.SimpleURLTreeI,
) error {
	if len(records) == 0 {
		return nil
	}
	filteredRecords := filterOutInternalRecords(records)
	notifyErrorRecord(filteredRecords.OnError)
	combinedAggsToPersist, err := GetUpdatedAggregations(
		*state.aggregation,
		filteredRecords.AccessLogs,
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

func filterOutInternalRecords(records []common.AccessLog) FilterResult {
	filterResult := FilterResult{
		OnError:    &shared_discovery.OnError{FailedTransactions: map[string]struct{}{}},
		AccessLogs: []AccessLog{},
	}

	for _, record := range records {
		if !record.Internal {
			filterResult.RecordErrorTransactionIfNeeds(record.RequestID, record.StatusCode)
			filterResult.AccessLogs = append(filterResult.AccessLogs, AccessLog(record))
		}
	}

	return filterResult
}

func notifyErrorRecord(tnxErrors *shared_discovery.OnError) {
	if tnxErrors.IsEmpty() {
		return
	}

	if engineAdminPort == "" {
		log.Debug().Msg("ENGINE_ADMIN_PORT ENV is not set")
		return
	}

	url := url.URL{
		Scheme: "http",
		Host:   fmt.Sprintf("127.0.0.1:%s", engineAdminPort),
		Path:   "/on_haproxy_error",
	}

	payloadBytes, err := tnxErrors.JSONMarshal()
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal payload")
		return
	}

	payload := strings.NewReader(string(payloadBytes))
	req, err := http.NewRequest(http.MethodPut, url.String(), payload)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create request")
		return
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to send request")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Error().Msgf("Failed to notify for record ID %s, status code: %d",
			tnxErrors, resp.StatusCode)
	}
}
