package streams

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	streamfilter "lunar/engine/streams/filter"
	streamflow "lunar/engine/streams/flow"
	internal_types "lunar/engine/streams/internal-types"
	"lunar/engine/streams/stream"
	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
)

type Stream struct {
	APIStreams *stream.Stream
	filterTree internal_types.FilterTreeI
}

func NewStream() *Stream {
	return &Stream{
		APIStreams: stream.NewStream(),
		filterTree: streamfilter.NewFilterTree(),
	}
}

func (s *Stream) CreateFlows(flowReps []*streamconfig.FlowRepresentation) error {
	return streamflow.BuildFlows(s.filterTree, flowReps)
}

func (s *Stream) ExecuteFlow(APIStream *streamtypes.APIStream) (err error) {
	log.Trace().Msgf("Executing flow for APIStream %v", APIStream.Name)

	flow := s.filterTree.GetFlow(APIStream)

	var start internal_types.EntryPointI
	if APIStream.Type.IsRequestType() {
		start, err = flow.GetRequestDirection().GetRoot()
	} else if APIStream.Type.IsResponseType() {
		start, err = flow.GetResponseDirection().GetRoot()
	} else {
		err = fmt.Errorf("unknown stream type")
	}
	if err != nil {
		return err
	}

	return s.APIStreams.ExecuteFlow(APIStream, start.GetNode())
}
