package discovery

import (
	"errors"
	sharedDiscovery "lunar/shared-model/discovery"
	"os"

	"github.com/goccy/go-json"
)

type APICallsState struct {
	apiCallMetricsState *APICallMetricData
	StateFilePath       string
}

func (state *APICallsState) InitializeState() error {
	_, err := os.Stat(state.StateFilePath)
	if err != nil {
		// If the file does not exist, create it and initialize an empty APICallMetricData
		if !errors.Is(err, os.ErrNotExist) {
			return err
		}

		state.apiCallMetricsState = &APICallMetricData{
			Labels:  map[string]sharedDiscovery.APICallsMetric{},
			Metrics: map[string]int64{},
		}

		bytes, marshalErr := json.Marshal(state.apiCallMetricsState)
		if marshalErr != nil {
			return marshalErr
		}
		return os.WriteFile(state.StateFilePath, bytes, 0o644)
	}

	// If the file exists, read the initial metrics state from it
	bytes, err := os.ReadFile(state.StateFilePath)
	if err != nil {
		return err
	}
	state.apiCallMetricsState = &APICallMetricData{}
	return json.Unmarshal(bytes, state.apiCallMetricsState)
}

func (state *APICallsState) UpdateState() error {
	bytes, err := json.Marshal(*state.apiCallMetricsState)
	if err != nil {
		return err
	}
	return os.WriteFile(state.StateFilePath, bytes, os.ModeAppend)
}
