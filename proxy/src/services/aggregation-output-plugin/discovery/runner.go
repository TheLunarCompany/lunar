package discovery

import (
	"errors"
	"fmt"
	"lunar/aggregation-plugin/common"
	"lunar/toolkit-core/client"
	context_manager "lunar/toolkit-core/context-manager"
	"net/http"
	"net/url"
	"os"
	"strings"

	shared_discovery "lunar/shared-model/discovery"

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
	_ = notifyErrorRecord(filteredRecords.OnError)
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

func notifyErrorRecord(tnxErrors *shared_discovery.OnError) error {
	retryConfig := client.RetryConfig{
		Attempts:            5,
		SleepMillis:         250,
		WithInitialSleep:    false,
		SleepIncreaseFactor: 2,
		InitialSleepMillis:  0,

		FailedAttemptLog: "Failed attempt to notify error record",
		FailureLog:       "Failed to notify error record after retries",
	}

	_, err := client.WithRetry(
		context_manager.Get().GetClock(),
		&retryConfig,
		func() (interface{}, error) {
			err := innerNotifyErrorRecord(tnxErrors)
			if err != nil {
				log.Trace().Err(err).Msgf("Failed to notify error record, retrying...")
				return nil, err
			}
			return struct{}{}, nil
		},
	)
	return err
}

func innerNotifyErrorRecord(tnxErrors *shared_discovery.OnError) error {
	if tnxErrors.IsEmpty() {
		return nil
	}

	if engineAdminPort == "" {
		return fmt.Errorf("ENGINE_ADMIN_PORT ENV is not set")
	}

	url := url.URL{
		Scheme: "http",
		Host:   fmt.Sprintf("127.0.0.1:%s", engineAdminPort),
		Path:   "/on_haproxy_error",
	}

	payloadBytes, err := tnxErrors.JSONMarshal()
	if err != nil {
		return err
	}

	payload := strings.NewReader(string(payloadBytes)) // recreate reader each attempt
	req, err := http.NewRequest(http.MethodPut, url.String(), payload)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}

	defer resp.Body.Close()

	if resp.StatusCode == http.StatusOK {
		return nil
	}
	return fmt.Errorf("unexpected status code: %d, expected: %d", resp.StatusCode, http.StatusOK)
}
