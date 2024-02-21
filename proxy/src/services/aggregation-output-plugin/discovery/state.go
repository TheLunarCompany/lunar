package discovery

import (
	"lunar/aggregation-plugin/common"
	"lunar/toolkit-core/clock"
	"os"

	"github.com/goccy/go-json"
)

type State struct {
	aggregation *Agg
	Filepath    string
	Clock       clock.Clock
}

func (state *State) InitializeState() error {
	initialAgg := Agg{
		Endpoints:    map[common.Endpoint]EndpointAgg{},
		Interceptors: map[common.Interceptor]InterceptorAgg{},
	}
	state.aggregation = &initialAgg
	bytes, err := json.Marshal(ConvertToPersisted(initialAgg, state.Clock))
	if err != nil {
		return err
	}

	return os.WriteFile(state.Filepath, bytes, 0o644)
}

func (state *State) UpdateAggregation(
	aggregation *Agg,
) error {
	state.aggregation = aggregation

	bytes, err := json.Marshal(ConvertToPersisted(*state.aggregation, state.Clock))
	if err != nil {
		return err
	}
	return os.WriteFile(state.Filepath, bytes, os.ModeAppend)
}
