package stream

import (
	streamconfig "lunar/engine/streams/config"
	streamfilter "lunar/engine/streams/filter"
	streamflow "lunar/engine/streams/flow"
	streamtypes "lunar/engine/streams/types"
)

type Stream struct {
	Request  *streamconfig.RequestStream
	Response *streamconfig.ResponseStream
}

func NewStream() streamconfig.Stream {
	return &Stream{}
}

func (stream *Stream) GetRequestStream() *streamconfig.RequestStream {
	return stream.Request
}

func (stream *Stream) GetResponseStream() *streamconfig.ResponseStream {
	return stream.Response
}

func (stream *Stream) NewFlow(_ *streamfilter.Filter) (*streamflow.Flow, error) {
	return streamflow.NewFlow(), nil
}

func (stream *Stream) ExecuteFlow(
	_ *streamfilter.Filter,
	_ *streamtypes.APIStream,
) error {
	return nil
}
