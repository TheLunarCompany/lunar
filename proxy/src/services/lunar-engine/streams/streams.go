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
	apiStreams *stream.Stream
	filterTree internal_types.FilterTreeI
}

func NewStream() *Stream {
	return &Stream{
		apiStreams: stream.NewStream(),
		filterTree: streamfilter.NewFilterTree(),
	}
}

// Initialize initializes the stream engine by creating flows from the stream config.
func (s *Stream) Initialize() error {
	flowsDefinition, err := streamconfig.GetFlows()
	if err != nil {
		return fmt.Errorf("failed to parse streams config: %w", err)
	}
	err = s.createFlows(flowsDefinition)
	if err != nil {
		return fmt.Errorf("failed to create flows: %w", err)
	}
	return nil
}

func (s *Stream) createFlows(flowReps []*streamconfig.FlowRepresentation) error {
	return streamflow.BuildFlows(s.filterTree, flowReps)
}

func (s *Stream) ExecuteFlow(apiStream *streamtypes.APIStream) (err error) {
	log.Trace().Msgf("Executing flow for APIStream %v", apiStream.Name)

	flow := s.filterTree.GetFlow(apiStream)
	var start internal_types.EntryPointI
	if apiStream.Type.IsRequestType() {
		start, err = flow.GetRequestDirection().GetRoot()
	} else if apiStream.Type.IsResponseType() {
		start, err = flow.GetResponseDirection().GetRoot()
	} else {
		err = fmt.Errorf("unknown stream type")
	}
	if err != nil {
		return err
	}
	return s.apiStreams.ExecuteFlow(apiStream, start.GetNode())
}

func (s *Stream) GetAPIStreams() *stream.Stream {
	return s.apiStreams
}
