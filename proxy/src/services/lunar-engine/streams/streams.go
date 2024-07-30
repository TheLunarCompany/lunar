package streams

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	streamfilter "lunar/engine/streams/filter"
	streamflow "lunar/engine/streams/flow"
	internal_types "lunar/engine/streams/internal-types"
	"lunar/engine/streams/processors"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/streams/resources"
	"lunar/engine/streams/stream"
	"lunar/engine/utils"

	"github.com/rs/zerolog/log"
)

type Stream struct {
	apiStreams        *stream.Stream
	filterTree        internal_types.FilterTreeI
	processorsManager *processors.ProcessorManager
	resources         *resources.ResourceManagement
	supportedFilters  map[publictypes.ComparableFilter][]streamconfig.Filter
}

func NewStream() *Stream {
	resources, err := resources.NewResourceManagement()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create resources")
	}
	return &Stream{
		apiStreams:        stream.NewStream(),
		filterTree:        streamfilter.NewFilterTree(),
		processorsManager: processors.NewProcessorManager(resources),
		resources:         resources,
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
	s.supportedFilters = map[publictypes.ComparableFilter][]streamconfig.Filter{}
	for key, resource := range s.resources.GetFlowsData() {
		s.supportedFilters[key] = append(s.supportedFilters[key], *resource.GetFilter())
	}

	for _, flow := range flowsDefinition {
		s.supportedFilters[flow.Filters.ToComparable()] = append(
			s.supportedFilters[flow.Filters.ToComparable()],
			flow.Filters,
		)
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

func (s *Stream) ExecuteFlow(apiStream publictypes.APIStreamI) (err error) {
	log.Trace().Msgf("Executing flow for APIStream %v", apiStream.GetName())

	// resetting apiStream instance before flow execution
	s.apiStreams = stream.NewStream()

	flow := s.filterTree.GetFlow(apiStream)
	if utils.IsInterfaceNil(flow) {
		log.Trace().Msgf("No flow found for %v", apiStream.GetURL())
		return nil
	}

	apiStream.SetContext(flow.GetExecutionContext())
	defer flow.CleanExecution()

	log.Trace().Msgf("Flow %v found for %v", flow.GetName(), apiStream.GetURL())
	var flowDir internal_types.FlowDirectionI
	if apiStream.GetType().IsRequestType() {
		flowDir = flow.GetRequestDirection()
	} else if apiStream.GetType().IsResponseType() {
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
	return streamflow.BuildFlows(s.filterTree, flowReps, s.processorsManager, s.resources)
}

func (s *Stream) GetSupportedFilters() map[publictypes.ComparableFilter][]streamconfig.Filter {
	return s.supportedFilters
}
