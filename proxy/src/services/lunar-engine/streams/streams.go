package streams

import (
	streamconfig "lunar/engine/streams/config"
	"lunar/engine/streams/stream"
	streamtypes "lunar/engine/streams/types"
)

type Stream struct {
	APIStreams *stream.Stream
}

func NewStream() *Stream {
	return &Stream{&stream.Stream{}}
}

func (s *Stream) CreateFlows(_ []*streamconfig.FlowRepresentation) error {
	return nil
}

func (s *Stream) ExecuteFlow(
	APIStream *streamtypes.APIStream,
) error {
	return s.APIStreams.ExecuteFlow(APIStream)
}
