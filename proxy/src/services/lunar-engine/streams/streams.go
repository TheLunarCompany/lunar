package streams

import (
	streamconfig "lunar/engine/streams/config"
	streamfilter "lunar/engine/streams/filter"
	"lunar/engine/streams/stream"
	streamtypes "lunar/engine/streams/types"
)

type Stream struct {
	APIStreams *stream.Stream
}

func NewStream() *Stream {
	return &Stream{&stream.Stream{}}
}

func (s *Stream) CreateFlows(_ *streamconfig.Flow) error {
	return nil
}

func (s *Stream) ExecuteFlow(
	filter *streamfilter.Filter,
	APIStream *streamtypes.APIStream,
) error {
	return s.APIStreams.ExecuteFlow(filter, APIStream)
}
