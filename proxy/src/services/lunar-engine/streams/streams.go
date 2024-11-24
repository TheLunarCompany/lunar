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

// This struct is used to store the node that caused the short circuit
// So when we execute the response flows, we can start from the node that caused the short circuit
// as intended by the user
type shortCircuitOperation struct {
	node internaltypes.FlowGraphNodeI
	flow internaltypes.FlowI
}

type Stream struct {
	apiStreams        *stream.Stream
	filterTree        internaltypes.FilterTreeI
	processorsManager *processors.ProcessorManager
	resources         *resources.ResourceManagement
	supportedFilters  map[publictypes.ComparableFilter][]publictypes.FilterI
	loadedConfig      network.ConfigurationData
	lunarHub          *communication.HubCommunication
	metricsData       *flowMetricsData
	strictMode        bool // if true - any error will stop initialization
}

func NewStream() (*Stream, error) {
	resources, err := resources.NewResourceManagement()
	if err != nil {
		log.Err(err).Msg("Failed to create resources")
		return nil, err
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
	}, nil
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

// WithStrictMode sets the stream engine to strict mode.
// In strict mode, any error will stop initialization.
// Used for validation purposes.
func (s *Stream) WithStrictMode() *Stream {
	s.strictMode = true
	return s
}

// Initialize initializes the stream engine by creating flows from the stream config.
func (s *Stream) Initialize() error {
	log.Info().Msg("Initializing stream engine")

	flowsDefinition, err := streamconfig.GetFlows()
	if err != nil {
		if s.strictMode {
			return fmt.Errorf("failed to get flows: %w", err)
		}
		if len(flowsDefinition) > 0 {
			log.Warn().Err(err).Msg("Part of flows have errors and have been skipped")
		} else {
			return fmt.Errorf("failed to get flows: %w", err)
		}
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
			if flow.GetData().IsDataSet() {
				s.loadedConfig.Data = append(s.loadedConfig.Data, flow.GetData())
			} else {
				log.Debug().Msgf("Empty configuration payload for flow: %s", flow.GetName())
			}
		}
	}

	filterToFileName := make(map[publictypes.ComparableFilter]string)

	for _, flow := range flowsDefinition {
		s.supportedFilters[flow.GetFilter().ToComparable()] = append(
			s.supportedFilters[flow.GetFilter().ToComparable()],
			flow.GetFilter(),
		)
		filterToFileName[flow.GetFilter().ToComparable()] = flow.GetData().FileName
	}

	log.Trace().Msgf("Supported filters: %v", s.supportedFilters)

	// Set path params for all supported filters to be used by the aggregation output plugin
	for comparableFilter, filters := range s.supportedFilters {
		for _, filter := range filters {
			err = s.resources.SetPathParams(filter.GetURL())
			if err != nil {
				fileName := filterToFileName[comparableFilter]
				return fmt.Errorf("while parsing file %s duplication found: %w."+
					" Please fix the error and restart the container", fileName, err)
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

	for _, flow := range flowsDefinition {
		for processorKey, processorData := range flow.GetProcessors() {
			_, errCreation := s.processorsManager.CreateProcessor(processorData)
			if errCreation != nil {
				return fmt.Errorf("failed to create processor %s: %w", processorKey, errCreation)
			}
		}
	}

	err = s.createFlows(flowsDefinition)
	if err != nil {
		return fmt.Errorf("failed to create flows: %w", err)
	}

	s.metricsData.setActiveFlows(userFlows)
	return nil
}

// InitializeHubCommunication notifies the hub about the loaded config of the stream engine
func (s *Stream) InitializeHubCommunication() {
	s.notifyHub()
}

func (s *Stream) ExecuteFlow(
	apiStream publictypes.APIStreamI,
	actions *streamconfig.StreamActions,
) error {
	log.Trace().Msgf("Executing flow for APIStream %v", apiStream.GetName())

	// resetting apiStream instance before flow execution
	flowsToExecute, found := s.filterTree.GetFlow(apiStream)
	if !found {
		log.Debug().Msgf("No flow found for %v", apiStream.GetURL())
		return nil
	}

	s.apiStreams = stream.NewStream().
		WithProcessorExecutionTimeMeasurement(s.metricsData.procMetricsData.measureProcExecutionTime)

	var err error
	if apiStream.GetType().IsRequestType() {
		s.metricsData.incrementRequestsThroughFlows()
		err = s.executeReq(flowsToExecute, apiStream, actions)

	} else if apiStream.GetType().IsResponseType() {
		err = s.executeRes(flowsToExecute, apiStream, actions, nil)
	}

	return err
}

func (s *Stream) executeReq(
	flowsToExecute internaltypes.FilterTreeResultI,
	apiStream publictypes.APIStreamI,
	actions *streamconfig.StreamActions,
) error {
	var err error
	var ShortCircuit *shortCircuitOperation
	// Execute System Flows
	if systemStart, found := flowsToExecute.GetSystemFlowStart(); found {
		for _, systemFlow := range systemStart {
			if resFlow := systemFlow.GetResponseDirection(); utils.IsInterfaceNil(resFlow) {
				continue
			}

			log.Debug().Msgf("Executing system start request flow %v", systemFlow.GetName())
			defer systemFlow.CleanExecution()
			_, err = s.executeFlow(systemFlow, apiStream, actions, nil)
			if err != nil {
				return fmt.Errorf("failed to execute system flow: %w", err)
			}
		}
	}

	// Execute User Flow
	if userFlows, found := flowsToExecute.GetUserFlow(); found {
		for _, userFlow := range userFlows {
			s.metricsData.incrementFlowInvocations()
			log.Debug().Msgf("Executing request flow %v", userFlow.GetName())
			defer userFlow.CleanExecution()
			var shortCircuitNode internaltypes.FlowGraphNodeI
			shortCircuitNode, err = s.executeFlow(userFlow, apiStream, actions, nil)
			if err != nil {
				return fmt.Errorf("failed to execute flow: %w", err)
			}
			if !utils.IsInterfaceNil(shortCircuitNode) {
				log.Debug().Msgf("Short circuit found in flow %v", userFlow.GetName())
				ShortCircuit = &shortCircuitOperation{
					node: shortCircuitNode,
					flow: userFlow,
				}

				break
			}
		}
	}

	// Execute System Flows
	if systemFlowEnd, found := flowsToExecute.GetSystemFlowEnd(); found {
		for _, systemFlow := range systemFlowEnd {
			log.Debug().Msgf("Executing system end request flow %v", systemFlow.GetName())
			defer systemFlow.CleanExecution()
			_, err = s.executeFlow(systemFlow, apiStream, actions, nil)
			if err != nil {
				return fmt.Errorf("failed to execute system flow: %w", err)
			}
		}
	}
	s.resources.OnRequestFinish(apiStream)
	// This is a short circuit, we need to handle the response flows (as it wont be executed otherwise)
	if ShortCircuit != nil {
		apiStream.SetType(publictypes.StreamTypeResponse)
		return s.executeRes(flowsToExecute, apiStream, actions, ShortCircuit)
	}
	return nil
}

func (s *Stream) executeRes(
	flowsToExecute internaltypes.FilterTreeResultI,
	apiStream publictypes.APIStreamI,
	actions *streamconfig.StreamActions,
	shortCircuit *shortCircuitOperation,
) error {
	var err error

	// Execute System Flows
	if systemFlows, found := flowsToExecute.GetSystemFlowStart(); found {
		for flowIndex := len(systemFlows) - 1; flowIndex >= 0; flowIndex-- {
			systemFlow := systemFlows[flowIndex]
			log.Debug().Msgf("Executing system start response flow %v", systemFlow.GetName())
			defer systemFlow.CleanExecution()
			_, err = s.executeFlow(systemFlow, apiStream, actions, nil)
			if err != nil {
				return fmt.Errorf("failed to execute system flow: %w", err)
			}
		}
	}

	if userFlows, found := flowsToExecute.GetUserFlow(); found {
		for flowIndex := len(userFlows) - 1; flowIndex >= 0; flowIndex-- {
			userFlow := userFlows[flowIndex]
			log.Debug().Msgf("Executing userFlow response flow %v", userFlow.GetName())
			defer userFlow.CleanExecution()
			if shortCircuit != nil && shortCircuit.flow.GetName() == userFlow.GetName() {
				_, err = s.executeFlow(userFlow, apiStream, actions, shortCircuit.node)
			} else {
				_, err = s.executeFlow(userFlow, apiStream, actions, nil)
			}
			if err != nil {
				return fmt.Errorf("failed to execute user flow: %w", err)
			}
		}
	}

	// Execute System Flows
	if systemFlows, found := flowsToExecute.GetSystemFlowEnd(); found {
		for flowIndex := len(systemFlows) - 1; flowIndex >= 0; flowIndex-- {
			systemFlow := systemFlows[flowIndex]
			log.Debug().Msgf("Executing system end response flow %v", systemFlow.GetName())
			defer systemFlow.CleanExecution()
			_, err = s.executeFlow(systemFlow, apiStream, actions, nil)
			if err != nil {
				return fmt.Errorf("failed to execute system flow: %w", err)
			}
		}
	}

	return nil
}

func (s *Stream) executeFlow(
	flow internaltypes.FlowI,
	apiStream publictypes.APIStreamI,
	actions *streamconfig.StreamActions,
	startFromNode internaltypes.FlowGraphNodeI,
) (internaltypes.FlowGraphNodeI, error) {
	var shortCircuitNode internaltypes.FlowGraphNodeI

	if utils.IsInterfaceNil(flow) {
		log.Trace().Msgf("No flow found for %v", apiStream.GetURL())
		return shortCircuitNode, nil
	}

	apiStream.SetContext(flow.GetExecutionContext())

	log.Trace().Msgf("Flow %v found for %v", flow.GetName(), apiStream.GetURL())
	flowDirection := flow.GetDirection(apiStream.GetType())

	if !flowDirection.IsDefined() {
		return shortCircuitNode, nil
	}

	// TODO: Handle the case where the root is not set.
	// we need to create the globalStream nodes and set them as default root.
	// If needed we could replace them with the needed root.
	start, _ := flowDirection.GetRoot()
	if utils.IsInterfaceNil(start) {
		return shortCircuitNode, nil
	}
	node := start.GetNode()

	if !utils.IsInterfaceNil(startFromNode) {
		// If we have a short circuit, we need to start from the node that caused it
		// We assume that the node (GenerateResponse) has only one edge (one target node)
		if len(startFromNode.GetEdges()) != 0 {
			edge := startFromNode.GetEdges()[0]
			if !edge.IsNodeAvailable() {
				// if no node is available, it means node connects to stream, meaning 'end of walk'
				return shortCircuitNode, nil
			}
			node = edge.GetTargetNode()
		} else {
			log.Debug().Msgf("Short circuit node %v has no target node", startFromNode.GetProcessorKey())
		}
	}

	var err error
	closureFunc := func() error {
		shortCircuitNode, err = s.apiStreams.ExecuteFlow(flow, apiStream, node, actions)
		return err
	}

	return shortCircuitNode, s.metricsData.measureFlowExecutionTime(closureFunc)
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
	log.Debug().Msg("Attaching standalone system flows")
	for _, systemFlowRepresentation := range s.resources.GetUnReferencedFlowData() {

		systemFlowStart := systemFlowRepresentation.GenerateSystemFlowStart()
		if systemFlowStart != nil {
			log.Debug().Msgf("Attaching standalone system flow %s: %v",
				systemFlowStart.GetType().String(), systemFlowStart.GetName())
			flowReps[systemFlowStart.GetName()] = systemFlowStart
		}

		systemFlowEnd := systemFlowRepresentation.GenerateSystemFlowEnd()
		if systemFlowEnd != nil {
			log.Debug().Msgf("Attaching standalone system flow %s: %v",
				systemFlowEnd.GetType().String(), systemFlowEnd.GetName())
			flowReps[systemFlowEnd.GetName()] = systemFlowEnd
		}
	}

	return nil
}
