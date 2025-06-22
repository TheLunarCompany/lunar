package streams

import (
	"fmt"
	"lunar/engine/communication"
	lunar_messages "lunar/engine/messages"
	"lunar/engine/metrics"
	streamconfig "lunar/engine/streams/config"
	streamfilter "lunar/engine/streams/filter"
	streamflow "lunar/engine/streams/flow"
	internaltypes "lunar/engine/streams/internal-types"
	lunar_context "lunar/engine/streams/lunar-context"
	"lunar/engine/streams/processors"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/streams/resources"
	"lunar/engine/streams/stream"
	stream_types "lunar/engine/streams/types"
	"lunar/engine/utils"
	"lunar/engine/utils/environment"
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

	validationMode bool // if true - any error will stop initialization
	validationPath string
}

func NewStream() (*Stream, error) {
	resources, err := resources.NewResourceManagement()
	if err != nil {
		log.Err(err).Msg("Failed to create resources")
		return nil, err
	}

	return newStream(resources, newFlowMetricsData()), nil
}

func NewValidationStream(dir string) (*Stream, error) {
	resources, err := resources.NewValidationResourceManagement(dir)
	if err != nil {
		log.Err(err).Msg("Failed to create resources for validation")
		return nil, err
	}

	return newStream(resources, newFlowMetricsData()).WithValidationPath(dir), nil
}

func (s *Stream) OnError(transactionID string) {
	onResponse := lunar_messages.OnResponse{LunarName: "OnTransactionError"} //nolint:exhaustruct
	onResponse.ID = transactionID
	onResponse.SequenceID = transactionID
	apiStream := stream_types.NewResponseAPIStream(onResponse, lunar_context.NewMemoryState[[]byte]())
	s.resources.OnRequestDrop(apiStream)
}

func (s *Stream) GetLoadedConfig() network.ConfigurationData {
	return s.loadedConfig
}

func (s *Stream) GetActiveFlows() int64 {
	return s.metricsData.getActiveFlows()
}

func (s *Stream) GetFlowInvocations() map[string]int64 {
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

// WithValidationMode sets the stream engine to validation mode.
// In validation mode, any error will stop initialization.
// Used for validation purposes.
func (s *Stream) WithValidationMode() *Stream {
	s.validationMode = true
	return s
}

// WithValidationPath sets the path to the validation file.
func (s *Stream) WithValidationPath(validationPath string) *Stream {
	s.validationMode = true
	s.validationPath = validationPath
	return s
}

// Initialize initializes the stream engine by creating flows from the stream config.
func (s *Stream) Initialize() error {
	log.Info().Msg("Initializing stream engine")

	flowsDefinition, err := s.getFlows()
	if err != nil {
		return err
	}

	userFlows := len(flowsDefinition)

	err = s.attachSystemFlows(flowsDefinition)
	if err != nil {
		return fmt.Errorf("failed to attach system flows: %w", err)
	}

	for key := range flowsDefinition {
		log.Info().Msgf("Adding flow %v to filter tree", key)
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
				log.Info().Msgf("Empty configuration payload for flow: %s", flow.GetName())
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

	log.Info().Msgf("Supported filters: %+v", s.supportedFilters)

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
			processor, errCreation := s.processorsManager.CreateProcessor(flow.GetName(), processorData)
			if errCreation != nil {
				return fmt.Errorf("failed to create processor %s: %w", processorKey, errCreation)
			}

			// Set the processors requirements to the filter.
			adminFilter := flow.GetFilter().(internaltypes.FlowFilterI)
			filterRequirements := adminFilter.GetRequirements()
			procRequirements := processor.GetRequirement()
			isBodyRequired := filterRequirements.IsBodyRequired || procRequirements.IsBodyRequired
			isReqCaptureRequired := filterRequirements.IsReqCaptureRequired ||
				procRequirements.IsReqCaptureRequired
			adminFilter.SetBodyRequired(isBodyRequired)
			adminFilter.SetReqCaptureRequired(isReqCaptureRequired)
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

// getFlows gets the flows from the flows directory.
// It can be either the directory defined by ENV var or the validation directory.
func (s *Stream) getFlows() (map[string]internaltypes.FlowRepI, error) {
	var flowsDir string
	if s.validationPath != "" {
		flowsDir = environment.GetCustomFlowsDirectory(s.validationPath)
	}

	if flowsDir == "" {
		flowsDir = environment.GetStreamsFlowsDirectory()
	}

	flowsDefinition, err := streamconfig.GetFlows(flowsDir)
	if err != nil {
		if s.validationMode {
			return nil, fmt.Errorf("failed to get flows: %w", err)
		}
		if len(flowsDefinition) > 0 {
			log.Warn().Err(err).Msg("Part of flows have errors and have been skipped")
		} else {
			return nil, fmt.Errorf("failed to get flows: %w", err)
		}
	}
	return flowsDefinition, nil
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
			if reqFlow := systemFlow.GetRequestDirection(); utils.IsInterfaceNil(reqFlow) {
				continue
			}

			log.Trace().Msgf("Executing system start request flow %v", systemFlow.GetName())
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
			s.metricsData.incrementFlowInvocations(userFlow.GetName())
			log.Debug().Msgf("Executing request flow %v", userFlow.GetName())
			defer userFlow.CleanExecution()
			var shortCircuitData *stream.ShortCircuitData
			shortCircuitData, err = s.executeFlow(userFlow, apiStream, actions, nil)
			if err != nil {
				return fmt.Errorf("failed to execute flow: %w", err)
			}
			if shortCircuitData != nil {
				if shortCircuitData.IsInternalShortCircuit {
					return nil
				}
				ShortCircuit = &shortCircuitOperation{
					node: shortCircuitData.Node,
					flow: userFlow,
				}

				break
			}
		}
	}

	// Execute System Flows
	if systemFlowEnd, found := flowsToExecute.GetSystemFlowEnd(); found {
		for _, systemFlow := range systemFlowEnd {
			log.Trace().Msgf("Executing system end request flow %v", systemFlow.GetName())
			defer systemFlow.CleanExecution()
			_, err = s.executeFlow(systemFlow, apiStream, actions, nil)
			if err != nil {
				return fmt.Errorf("failed to execute system flow: %w", err)
			}
		}
	}

	// This is a short circuit, we need to handle the response flows (as it wont be executed otherwise)
	if ShortCircuit != nil {
		apiStream.SetType(publictypes.StreamTypeResponse)
		flowsToExecute, found := s.filterTree.GetFlow(apiStream)
		if !found {
			log.Trace().Msgf("No flow found for %v", apiStream.GetURL())
			return nil
		}
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
			log.Trace().Msgf("Executing system start response flow %v", systemFlow.GetName())
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
			log.Trace().Msgf("Executing system end response flow %v", systemFlow.GetName())
			defer systemFlow.CleanExecution()
			_, err = s.executeFlow(systemFlow, apiStream, actions, nil)
			if err != nil {
				return fmt.Errorf("failed to execute system flow: %w", err)
			}
		}
	}

	s.resources.OnResponseFinish(apiStream)
	return nil
}

func (s *Stream) executeFlow(
	flow internaltypes.FlowI,
	apiStream publictypes.APIStreamI,
	actions *streamconfig.StreamActions,
	startFromNode internaltypes.FlowGraphNodeI,
) (*stream.ShortCircuitData, error) {
	var shortCircuitData *stream.ShortCircuitData

	if utils.IsInterfaceNil(flow) {
		log.Trace().Msgf("No flow found for %v", apiStream.GetURL())
		return shortCircuitData, nil
	}

	apiStream.SetContext(flow.GetExecutionContext())

	log.Trace().Msgf("Flow %v found for %v", flow.GetName(), apiStream.GetURL())
	flowDirection := flow.GetDirection(apiStream.GetType())

	if !flowDirection.IsDefined() {
		return shortCircuitData, nil
	}

	// TODO: Handle the case where the root is not set.
	// we need to create the globalStream nodes and set them as default root.
	// If needed we could replace them with the needed root.
	start, _ := flowDirection.GetRoot()
	if utils.IsInterfaceNil(start) {
		return shortCircuitData, nil
	}
	node := start.GetNode()

	if !utils.IsInterfaceNil(startFromNode) {
		// If we have a short circuit, we need to start from the node that caused it
		// We assume that the node (GenerateResponse) has only one edge (one target node)
		if len(startFromNode.GetEdges()) != 0 {
			edge := startFromNode.GetEdges()[0]
			if !edge.IsNodeAvailable() {
				// if no node is available, it means node connects to stream, meaning 'end of walk'
				return shortCircuitData, nil
			}
			node = edge.GetTargetNode()
		} else {
			log.Debug().Msgf("Short circuit node %v has no target node", startFromNode.GetProcessorKey())
		}
	}

	var err error
	closureFunc := func() error {
		shortCircuitData, err = s.apiStreams.ExecuteFlow(flow, apiStream, node, actions)
		return err
	}

	return shortCircuitData, s.metricsData.measureFlowExecutionTime(closureFunc)
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
		log.Debug().Msg("No Hub communication, skipping notification")
		return
	}
	log.Debug().Msg("Notifying Hub about loaded config")
	s.loadedConfig.Data = append(s.loadedConfig.Data, s.resources.GetLoadedConfig()...)
	s.loadedConfig.Data = append(s.loadedConfig.Data, s.processorsManager.GetLoadedConfig()...)

	if s.loadedConfig.Data == nil {
		log.Debug().Msg("No configuration loaded, skipping notification to Hub")
		return
	}

	sent := s.lunarHub.SendDataToHub(&network.ConfigurationMessage{
		Event: network.WebSocketEventConfigurationLoad,
		Data:  s.loadedConfig,
	})
	if !sent && !s.lunarHub.IsConnected() {
		log.Info().Msg(
			"Failed to send configuration to Hub, will wait for connection and send again in the background",
		)
		go s.notifyHubWhenAvailable()
	}
}

func (s *Stream) notifyHubWhenAvailable() {
	<-s.lunarHub.ConnectionEstablishedChannel()
	sent := s.lunarHub.SendDataToHub(&network.ConfigurationMessage{
		Event: network.WebSocketEventConfigurationLoad,
		Data:  s.loadedConfig,
	})
	if !sent {
		log.Warn().
			Msg("Failed to send configuration to Hub after receiving connection established notification")
	} else {
		log.Info().Msg("Configuration sent to Hub after connection established")
	}
}

// The following functions are patch functions to disable the quota processor logic.
// This is a fast delivery to disable the quota processor logic until we fix the infrastructure.
func (s *Stream) getQuotaReferences(
	flowReps map[string]internaltypes.FlowRepI,
) map[string]struct{} {
	result := make(map[string]struct{})
	for _, flow := range flowReps {
		for _, processor := range flow.GetProcessors() {
			for key, value := range processor.ParamMap() {
				if key == "quota_id" {
					result[value.GetString()] = struct{}{}
					s.addParentsQuotaReferences(value, result)
					continue
				}
			}
		}
	}
	return result
}

func (s *Stream) addParentsQuotaReferences(
	value *publictypes.ParamValue,
	result map[string]struct{},
) {
	quotaResource, err := s.resources.GetQuota(value.GetString(), "")
	if err != nil {
		// No parent quota found!
		return
	}

	parentQuotaID := quotaResource.GetParentID()
	for parentQuotaID != "" {
		result[parentQuotaID] = struct{}{}
		quotaResource, err = s.resources.GetQuota(parentQuotaID, "")
		if err != nil {
			// No parent quota found!
			return
		}
		parentQuotaID = quotaResource.GetParentID()
	}
}

// The following functions are patch functions to disable the quota processor logic.
// This is a fast delivery to disable the quota processor logic until we fix the infrastructure.
func (s *Stream) disableQuotaProcessorLogic(
	quotaFlow internaltypes.FlowRepI,
	relevantQuotas map[string]struct{},
) {
	getParamIndex := func(params []*publictypes.KeyValue, key string) int {
		for i, param := range params {
			if param.Key == key {
				return i
			}
		}
		return -1 // Not found
	}
	for _, processor := range quotaFlow.GetProcessors() {
		params := processor.ParamList()
		quotaIDIndex := getParamIndex(params, "quota_id")
		if quotaIDIndex == -1 {
			continue
		}
		// This is a patch to disable the quota processor logic.
		shouldApplyLogicKey := "should_apply_logic"
		applyLogicIndex := getParamIndex(params, shouldApplyLogicKey)
		quotaParam := params[quotaIDIndex]
		quotaParamValue := quotaParam.GetParamValue()
		quotaID := quotaParamValue.GetString()

		if _, ok := relevantQuotas[quotaID]; ok {
			newKeyValue := &publictypes.KeyValue{
				Key:   shouldApplyLogicKey,
				Value: false,
			}
			if applyLogicIndex == -1 {
				// No apply logic param found, add it
				processor.AddParam(newKeyValue)
			} else {
				// Apply logic param found, update it
				if err := processor.UpdateParam(applyLogicIndex, newKeyValue); err != nil {
					log.Debug().Msgf("Failed to update param %v for processor %v",
						newKeyValue.Key, processor.GetName())
				}
			}
		}
	}
}

func (s *Stream) attachSystemFlows(
	flowReps map[string]internaltypes.FlowRepI,
) error {
	log.Info().Msg("Attaching standalone system flows")
	// Here we take all references to quotas from the flows.
	quotaReferences := s.getQuotaReferences(flowReps)

	for _, systemFlowRepresentation := range s.resources.GetUnReferencedFlowData() {
		systemFlowStart := systemFlowRepresentation.GenerateSystemFlowStart()
		// Here we call to disable if needed the Inc processor logic (System start)
		s.disableQuotaProcessorLogic(systemFlowStart, quotaReferences)

		// We did not disable the Dec processor logic (System end) as it is not needed (for now)
		systemFlowEnd := systemFlowRepresentation.GenerateSystemFlowEnd()

		if systemFlowStart != nil {
			log.Info().Msgf("Attaching standalone system flow %s: %v",
				systemFlowStart.GetType().String(), systemFlowStart.GetName())
			flowReps[systemFlowStart.GetName()] = systemFlowStart
		}

		if systemFlowEnd != nil {
			log.Info().Msgf("Attaching standalone system flow %s: %v",
				systemFlowEnd.GetType().String(), systemFlowEnd.GetName())
			flowReps[systemFlowEnd.GetName()] = systemFlowEnd
		}
	}

	return nil
}

func newStream(resources *resources.ResourceManagement, metricData *flowMetricsData) *Stream {
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
