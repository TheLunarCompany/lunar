package stream

import (
	streamfilter "lunar/engine/streams/filter"
	streamflow "lunar/engine/streams/flow"
	streamtypes "lunar/engine/streams/types"
)

type GlobalStream struct{}

func NewStream() *GlobalStream {
	return &GlobalStream{}
}

func (stream *GlobalStream) NewFlow(_ *streamfilter.Filter) (*streamflow.Flow, error) {
	return streamflow.NewFlow(), nil
}

func (stream *GlobalStream) ExecuteFlow(
	_ *streamfilter.Filter,
	_ *streamtypes.APIStream,
) error {
	return nil
}
