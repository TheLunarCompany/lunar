package streams

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	streamfilter "lunar/engine/streams/filter"
	streamflow "lunar/engine/streams/flow"
	internal_types "lunar/engine/streams/internal-types"
	"lunar/engine/streams/processors"
	"lunar/engine/streams/stream"
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils"

	"github.com/rs/zerolog/log"
)

type Stream struct {
	apiStreams        *stream.Stream
	filterTree        internal_types.FilterTreeI
	processorsManager *processors.ProcessorManager
	supportedFilters  []streamconfig.Filter
}

func NewStream() *Stream {
	return &Stream{
		apiStreams:        stream.NewStream(),
		filterTree:        streamfilter.NewFilterTree(),
		processorsManager: processors.NewProcessorManager(),
	}
}

// Initialize initializes the stream engine by creating flows from the stream config.
func (s *Stream) Initialize() error {
	log.Info().Msg("Initializing stream engine")

	flowsDefinition, err := streamconfig.GetFlows()
	if err != nil {
		return fmt.Errorf("failed to parse streams config: %w", err)
	}

	// Get all supported filters
	s.supportedFilters = make([]streamconfig.Filter, 0)
	for _, flow := range flowsDefinition {
		s.supportedFilters = append(s.supportedFilters, flow.Filters)
	}
	log.Trace().Msgf("Supported filters: %v", s.supportedFilters)

	log.Trace().Msg("Creating processors")
	if err = s.processorsManager.Init(); err != nil {
		return fmt.Errorf("failed to initialize processors: %w", err)
	}

	err = s.createFlows(flowsDefinition)
	if err != nil {
		return fmt.Errorf("failed to create flows: %w", err)
	}
	return nil
}

func (s *Stream) ExecuteFlow(apiStream *streamtypes.APIStream) (err error) {
	log.Trace().Msgf("Executing flow for APIStream %v", apiStream.Name)

	// resetting apiStream instance before flow execution
	s.apiStreams = stream.NewStream()

	flow := s.filterTree.GetFlow(apiStream)
	if utils.IsInterfaceNil(flow) {
		log.Trace().Msgf("No flow found for %v", apiStream.GetURL())
		return nil
	}

	apiStream.Context = flow.GetExecutionContext()
	defer flow.CleanExecution()

	log.Trace().Msgf("Flow %v found for %v", flow.GetName(), apiStream.GetURL())
	var flowDir internal_types.FlowDirectionI
	if apiStream.Type.IsRequestType() {
		flowDir = flow.GetRequestDirection()
	} else if apiStream.Type.IsResponseType() {
		flowDir = flow.GetResponseDirection()
	} else {
		return fmt.Errorf("unknown stream type")
	}

	if !flowDir.IsDefined() {
		return nil
	}

	start, err := flowDir.GetRoot()
	if err != nil {
		return err
	}
	return s.apiStreams.ExecuteFlow(flow, apiStream, start.GetNode())
}

func (s *Stream) GetAPIStreams() *stream.Stream {
	return s.apiStreams
}

func (s *Stream) createFlows(flowReps []*streamconfig.FlowRepresentation) error {
	return streamflow.BuildFlows(s.filterTree, flowReps, s.processorsManager)
}

func (s *Stream) GetSupportedFilters() []streamconfig.Filter {
	return s.supportedFilters
}
