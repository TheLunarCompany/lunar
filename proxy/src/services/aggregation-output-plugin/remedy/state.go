package remedy

import (
	"os"

	"github.com/goccy/go-json"
)

type State struct {
	aggregation *Aggregation
	Filepath    string
}

func (state *State) Initialize() error {
	initialAgg := Aggregation{} //nolint:exhaustruct
	initialAggToPersist := ConvertToPersisted(initialAgg)

	bytes, err := json.Marshal(initialAggToPersist)
	if err != nil {
		return err
	}

	state.aggregation = &initialAgg
	return os.WriteFile(state.Filepath, bytes, 0o644)
}

func (state *State) UpdateAggregation(aggregation *Aggregation) error {
	state.aggregation = aggregation
	bytes, err := json.Marshal(ConvertToPersisted(*state.aggregation))
	if err != nil {
		return err
	}
	return os.WriteFile(state.Filepath, bytes, os.ModeAppend)
}
