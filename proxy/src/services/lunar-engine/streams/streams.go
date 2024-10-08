package streams

import (
	"fmt"
	"lunar/engine/communication"
	"lunar/engine/metrics"
	streamconfig "lunar/engine/streams/config"
	streamfilter "lunar/engine/streams/filter"
	streamflow "lunar/engine/streams/flow"
	internaltypes "lunar/engine/streams/internal-types"
	"lunar/engine/streams/processors"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/streams/resources"
	"lunar/engine/streams/stream"
	"lunar/engine/utils"
	"lunar/toolkit-core/network"

	"github.com/rs/zerolog/log"
)

var _ metrics.FlowMetricsProviderI = &Stream{}

type Stream struct {
	apiStreams        *stream.Stream
	filterTree        internaltypes.FilterTreeI
	processorsManager *processors.ProcessorManager
	resources         *resources.ResourceManagement
	supportedFilters  map[publictypes.ComparableFilter][]publictypes.FilterI
	loadedConfig      network.ConfigurationData
	lunarHub          *communication.HubCommunication
	metricsData       *flowMetricsData
}

func NewStream() *Stream {
	resources, err := resources.NewResourceManagement()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create resources")
	}
	metricData := newFlowMetricsData()
	return &Stream{
		loadedConfig: network.ConfigurationData{},
		apiStreams: stream.NewStream().
			WithProcessorExecutionTimeMeasurement(metricData.procMetricsData.measureProcExecutionTime),
		filterTree:        streamfilter.NewFilterTree(),
		processorsManager: processors.NewProcessorManager(resources),
		resources:         resources,
		metricsData:       metricData,
	}
}

func (s *Stream) GetActiveFlows() int64 {
	return s.metricsData.getActiveFlows()
}

func (s *Stream) GetFlowInvocations() int64 {
	return s.metricsData.getFlowInvocations()
}

func (s *Stream) GetRequestsThroughFlows() int64 {
	return s.metricsData.getRequestsThroughFlows()
}

func (s *Stream) GetAvgFlowExecutionTime() float64 {
	return s.metricsData.getAvgFlowExecutionTime()
}

func (s *Stream) GetAvgProcessorExecutionTime() float64 {
	return s.metricsData.getAvgProcessorExecutionTime()
}

func (s *Stream) WithHub(hub *communication.HubCommunication) *Stream {
	s.lunarHub = hub
	return s
}

// Initialize initializes the stream engine by creating flows from the stream config.
func (s *Stream) Initialize() error {
	log.Info().Msg("Initializing stream engine")

	flowsDefinition, err := streamconfig.GetFlows()
	if err != nil {
		return fmt.Errorf("failed to parse streams config: %w", err)
	}
	userFlows := len(flowsDefinition)

	err = s.attachSystemFlows(flowsDefinition)
	if err != nil {
		return fmt.Errorf("failed to attach system flows: %w", err)
	}

	for key := range flowsDefinition {
		log.Trace().Msgf("Adding flow %v to filter tree", key)
	}

	// Get all supported filters
	s.supportedFilters = map[publictypes.ComparableFilter][]publictypes.FilterI{}
	for key, resource := range s.resources.GetFlowsData() {
		s.supportedFilters[key] = append(s.supportedFilters[key], resource.GetFilter())
	}

	if s.lunarHub != nil {
		for _, flow := range flowsDefinition {
			s.loadedConfig.Data = append(s.loadedConfig.Data, flow.GetData())
		}
	}

	for _, flow := range flowsDefinition {
		s.supportedFilters[flow.GetFilter().ToComparable()] = append(
			s.supportedFilters[flow.GetFilter().ToComparable()],
			flow.GetFilter(),
		)
	}

	log.Trace().Msgf("Supported filters: %v", s.supportedFilters)

	// Set path params for all supported filters to be used by the aggregation output plugin
	for _, filters := range s.supportedFilters {
		for _, filter := range filters {
			err = s.resources.SetPathParams(filter.GetURL())
			if err != nil {
				return fmt.Errorf("duplication found: %w", err)
			}
		}
	}

	err = s.resources.GeneratePathParamConfFile()
	if err != nil {
		log.Warn().Err(err).Msg("Failed to generate path params configuration file")
	}

	log.Trace().Msg("Creating processors")
	if err = s.processorsManager.Init(); err != nil {
		return fmt.Errorf("failed to initialize processors: %w", err)
	}

	err = s.createFlows(flowsDefinition)
	if err != nil {
		return fmt.Errorf("failed to create flows: %w", err)
	}

	s.metricsData.setActiveFlows(userFlows)
	s.notifyHub() // Here we notify the hub about the loaded config of the stream engine
	return nil
}

func (s *Stream) ExecuteFlow(
	apiStream publictypes.APIStreamI,
	actions *streamconfig.StreamActions,
) (err error) {
	log.Trace().Msgf("Executing flow for APIStream %v", apiStream.GetName())

	// resetting apiStream instance before flow execution
	flowsToExecute := s.filterTree.GetFlow(apiStream)

	s.apiStreams = stream.NewStream().
		WithProcessorExecutionTimeMeasurement(s.metricsData.procMetricsData.measureProcExecutionTime)

	if apiStream.GetType().IsRequestType() {
		s.metricsData.incrementRequestsThroughFlows()

		for _, flow := range flowsToExecute {
			s.metricsData.incrementFlowInvocations()

			log.Trace().Msgf("Executing request flow %v", flow.GetName())
			defer flow.CleanExecution()
			err = s.executeFlow(flow, apiStream, actions)
			if err != nil {
				return fmt.Errorf("failed to execute flow: %w", err)
			}
		}

		s.resources.OnRequestFinish(apiStream)

	} else if apiStream.GetType().IsResponseType() {
		for i := len(flowsToExecute) - 1; i >= 0; i-- {
			log.Trace().Msgf("Executing response flow %v", flowsToExecute[i].GetName())
			defer flowsToExecute[i].CleanExecution()
			err = s.executeFlow(flowsToExecute[i], apiStream, actions)
			if err != nil {
				return fmt.Errorf("failed to execute flow: %w", err)
			}
		}
	}
	return err
}

func (s *Stream) executeFlow(
	flow internaltypes.FlowI,
	apiStream publictypes.APIStreamI,
	actions *streamconfig.StreamActions,
) error {
	if utils.IsInterfaceNil(flow) {
		log.Trace().Msgf("No flow found for %v", apiStream.GetURL())
		return nil
	}

	apiStream.SetContext(flow.GetExecutionContext())

	log.Trace().Msgf("Flow %v found for %v", flow.GetName(), apiStream.GetURL())
	flowDirection := flow.GetDirection(apiStream.GetType())

	if !flowDirection.IsDefined() {
		return nil
	}

	// TODO: Handle the case where the root is not set.
	// we need to create the globalStream nodes and set them as default root.
	// If needed we could replace them with the needed root.
	start, _ := flowDirection.GetRoot()
	if utils.IsInterfaceNil(start) {
		return nil
	}

	closureFunc := func() error {
		return s.apiStreams.ExecuteFlow(flow, apiStream, start.GetNode(), actions)
	}
	return s.metricsData.measureFlowExecutionTime(closureFunc)
}

func (s *Stream) GetAPIStreams() *stream.Stream {
	return s.apiStreams
}

func (s *Stream) createFlows(flowReps map[string]internaltypes.FlowRepI) error {
	return streamflow.BuildFlows(s.filterTree, flowReps, s.processorsManager, s.resources)
}

func (s *Stream) GetSupportedFilters() map[publictypes.ComparableFilter][]publictypes.FilterI {
	return s.supportedFilters
}

func (s *Stream) notifyHub() {
	if s.lunarHub == nil {
		return
	}
	log.Debug().Msg("Notifying hub about loaded config")
	s.loadedConfig.Data = append(s.loadedConfig.Data, s.resources.GetLoadedConfig()...)
	s.loadedConfig.Data = append(s.loadedConfig.Data, s.processorsManager.GetLoadedConfig()...)

	if s.loadedConfig.Data == nil {
		log.Debug().Msg("No configuration loaded, skipping notification to hub")
		return
	}

	s.lunarHub.SendDataToHub(&network.ConfigurationMessage{
		Event: network.WebSocketEventConfigurationLoad,
		Data:  s.loadedConfig,
	})
}

func (s *Stream) attachSystemFlows(
	flowReps map[string]internaltypes.FlowRepI,
) error {
	log.Debug().Msg("Attaching system flows")
	for _, flowRep := range flowReps {
		log.Trace().Msgf("Attaching system flow to flow: %v", flowRep.GetName())
		systemFlowAdapter, err := s.resources.GetFlowData(flowRep.GetFilter().ToComparable())
		if err != nil {
			return fmt.Errorf("failed to get system flow data: %w", err)
		}

		if systemFlowAdapter == nil {
			continue
		}
		_, err = systemFlowAdapter.AddSystemFlowToUserFlow(flowRep)
		if err != nil {
			return fmt.Errorf("failed to add system flow to user flow: %w", err)
		}
	}

	log.Debug().Msg("Attaching standalone system flows")
	for _, systemFlowRepresentation := range s.resources.GetUnReferencedFlowData() {
		systemFlow := systemFlowRepresentation.GenerateStandaloneFlow()
		if systemFlow != nil {
			flowReps[systemFlow.GetName()] = systemFlow
		}
	}

	return nil
}
