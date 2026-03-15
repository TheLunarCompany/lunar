package discovery

import (
	"errors"
	"lunar/aggregation-plugin/common"
	"os"

	sharedDiscovery "lunar/shared-model/discovery"

	"github.com/goccy/go-json"
)

type State struct {
	aggregation      *Agg
	DiscoverFilepath string
}

func (state *State) InitializeState() error {
	_, err := os.Stat(state.DiscoverFilepath)
	if err != nil {
		// If the file does not exist, create it and initialize an empty aggregation
		if !errors.Is(err, os.ErrNotExist) {
			return err
		}

		initialAgg := Agg{
			Endpoints:    map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg{},
			Interceptors: map[common.Interceptor]InterceptorAgg{},
		}
		state.aggregation = &initialAgg
		bytes, marshalErr := json.Marshal(ConvertToPersisted(initialAgg))
		if marshalErr != nil {
			return marshalErr
		}
		return os.WriteFile(state.DiscoverFilepath, bytes, 0o644)
	}

	// If the file exists, read the initial aggregation from it
	bytes, err := os.ReadFile(state.DiscoverFilepath)
	if err != nil {
		return err
	}
	output := sharedDiscovery.Output{}
	err = json.Unmarshal(bytes, &output)
	if err != nil {
		return err
	}
	state.aggregation = ConvertFromPersisted(output)
	return nil
}

func (state *State) UpdateAggregation(
	aggregation *Agg,
) error {
	state.aggregation = aggregation

	bytes, err := json.Marshal(ConvertToPersisted(*state.aggregation))
	if err != nil {
		return err
	}
	return os.WriteFile(state.DiscoverFilepath, bytes, os.ModeAppend)
}
