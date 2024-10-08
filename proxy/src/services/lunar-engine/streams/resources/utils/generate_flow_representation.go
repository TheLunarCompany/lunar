package resourceutils

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	resourcetypes "lunar/engine/streams/resources/types"
	"lunar/engine/utils"

	"github.com/rs/zerolog/log"
)

const (
	TemplateFlowName = "SystemFlow_"
)

type SystemFlowRepresentation struct {
	processors             map[string]publictypes.ProcessorDataI
	resourceFlow           publictypes.ResourceFlowI
	filter                 publictypes.FilterI
	systemFlowID           string
	isReferencedByUsedFlow bool
}

func NewSystemFlowRepresentation() *SystemFlowRepresentation {
	return &SystemFlowRepresentation{
		processors: make(map[string]publictypes.ProcessorDataI),
		resourceFlow: &resourcetypes.ResourceFlow{
			Request: &resourcetypes.ResourceProcessorLocation{
				Start: []string{},
				End:   []string{},
			},
			Response: &resourcetypes.ResourceProcessorLocation{
				Start: []string{},
				End:   []string{},
			},
		},
		isReferencedByUsedFlow: false,
	}
}

func (sfr *SystemFlowRepresentation) IsReferencedByUsedFlow() bool {
	return sfr.isReferencedByUsedFlow
}

func (sfr *SystemFlowRepresentation) GetFilter() publictypes.FilterI {
	return sfr.filter
}

func (sfr *SystemFlowRepresentation) GetID() string {
	return sfr.systemFlowID
}

func (sfr *SystemFlowRepresentation) GetProcessors() map[string]publictypes.ProcessorDataI {
	return sfr.processors
}

func (sfr *SystemFlowRepresentation) GetResourceFlow() publictypes.ResourceFlowI {
	return sfr.resourceFlow
}

func (sfr *SystemFlowRepresentation) AddSystemFlow(
	resourceFlow *resourcetypes.ResourceFlowData,
) error {
	log.Trace().Msgf("Adding system flow by ResourceFlowData %v", &resourceFlow)
	sfr.filter = resourceFlow.Filter
	sfr.systemFlowID = resourceFlow.GetID()

	if err := sfr.storeProcessors(resourceFlow.GetProcessors()); err != nil {
		return err
	}
	sfr.addProcessorConnection(resourceFlow.GetProcessorsConnections())
	return nil
}

func (sfr *SystemFlowRepresentation) AddSystemRepresentation(
	resourceRep *SystemFlowRepresentation,
) error {
	log.Trace().Msgf("Adding system flow by SystemFlowRepresentation %v", &resourceRep)

	processors := make(map[string]publictypes.ProcessorDataI)
	for processorKey, processor := range resourceRep.GetProcessors() {
		processors[processorKey] = processor
	}

	if err := sfr.storeProcessors(processors); err != nil {
		return err
	}
	sfr.addProcessorConnection(resourceRep.GetResourceFlow())
	return nil
}

func (sfr *SystemFlowRepresentation) GenerateStandaloneFlow() internaltypes.FlowRepI {
	log.Trace().Msgf("Generating standalone flow for %s", sfr.systemFlowID)
	systemFlow := sfr.GetFlowTemplate()
	sfr.linkSystemFlow(systemFlow, publictypes.StreamTypeRequest)
	sfr.linkSystemFlow(systemFlow, publictypes.StreamTypeResponse)
	log.Trace().Msgf("Generated standalone request flow %v", systemFlow.GetFlow().GetRequest())
	log.Trace().Msgf("Generated standalone response flow %v", systemFlow.GetFlow().GetResponse())
	// This is a workaround to avoid graph limit issue
	if len(systemFlow.GetFlow().GetResponse()) == 1 {
		systemFlow.GetFlow().SetResponse(nil)
	}
	log.Trace().Msgf("Generated standalone Processors %v", systemFlow.GetProcessors())
	return systemFlow
}

func (sfr *SystemFlowRepresentation) AddSystemFlowToUserFlow(
	userFlow internaltypes.FlowRepI,
) (internaltypes.FlowRepI, error) {
	sfr.isReferencedByUsedFlow = true
	log.Trace().Msgf("Adding system flow to user flow %s", userFlow.GetName())
	if err := sfr.addProcessorsToUserFlow(userFlow); err != nil {
		return nil, err
	}

	sfr.linkSystemFlow(userFlow, publictypes.StreamTypeRequest)
	sfr.linkSystemFlow(userFlow, publictypes.StreamTypeResponse)

	return userFlow, nil
}

func (sfr *SystemFlowRepresentation) linkSystemFlow(
	userFlow internaltypes.FlowRepI,
	flowType publictypes.StreamType,
) {
	log.Trace().Msgf("Linking system flow to flow %s for %s", userFlow.GetName(), flowType)
	flowConnection := userFlow.GetFlow().GetFlowConnections(flowType)
	processorsToConnect := sfr.getProcessorsByType(flowType, publictypes.StreamStart)

	if len(processorsToConnect) == 0 {
		log.Trace().Msg("No processors connection to link on StreamStart.")
		sfr.rewriteFlow(userFlow, sfr.linkSystemFlowEnd(flowConnection, flowType), flowType)
		return
	}

	currentConn := &streamconfig.ProcessorRef{
		Name: processorsToConnect[0],
	}

	var newFlow []internaltypes.FlowConnRepI
	newFlow = append(newFlow, &streamconfig.FlowConnection{
		From: &streamconfig.Connection{
			Stream: &streamconfig.StreamRef{
				Name: publictypes.GlobalStream,
				At:   publictypes.StreamStart,
			},
		},
		To: &streamconfig.Connection{
			Processor: currentConn,
		},
	})

	currentConn = sfr.appendSystemProcessorsToFlow(
		processorsToConnect[1:],
		flowConnection,
		currentConn,
		publictypes.StreamStart,
	)

	connectionLink := sfr.getLinkToUserProcessor(
		flowConnection,
		publictypes.StreamStart,
	)

	if connectionLink == nil {
		log.Warn().Msgf("No connection link found for %s", publictypes.StreamStart)
		sfr.rewriteFlow(userFlow, sfr.linkSystemFlowEnd(flowConnection, flowType), flowType)
		return
	}

	newFlow = append(newFlow, &streamconfig.FlowConnection{
		From: &streamconfig.Connection{
			Processor: currentConn,
		},
		To: connectionLink.(*streamconfig.Connection),
	})

	if utils.IsInterfaceNil(connectionLink.GetStream()) {
		newFlow = append(newFlow, flowConnection[1:]...)
	}

	sfr.rewriteFlow(userFlow, sfr.linkSystemFlowEnd(newFlow, flowType), flowType)
}

func (sfr *SystemFlowRepresentation) linkSystemFlowEnd(
	flowConnection []internaltypes.FlowConnRepI,
	flowType publictypes.StreamType,
) []internaltypes.FlowConnRepI {
	log.Trace().Msgf("Closing system flow on the flow type: %s", flowType)
	processorsToConnect := sfr.getProcessorsByType(flowType, publictypes.StreamEnd)

	if len(processorsToConnect) == 0 {
		log.Trace().Msg("No processors connection to link on StreamEnd.")
		return flowConnection
	}

	currentConn := &streamconfig.ProcessorRef{
		Name: processorsToConnect[0],
	}

	currentConn = sfr.appendSystemProcessorsToFlow(
		processorsToConnect[1:],
		flowConnection,
		currentConn,
		publictypes.StreamEnd,
	)

	flowConnection = append(flowConnection, &streamconfig.FlowConnection{
		From: &streamconfig.Connection{
			Processor: currentConn,
		},
		To: &streamconfig.Connection{
			Stream: &streamconfig.StreamRef{
				Name: publictypes.GlobalStream,
				At:   publictypes.StreamEnd,
			},
		},
	})
	return flowConnection
}

func (sfr *SystemFlowRepresentation) addProcessorsToUserFlow(
	userFlow internaltypes.FlowRepI,
) error {
	for processorKey, processor := range sfr.processors {
		if _, ok := userFlow.GetProcessors()[processorKey]; ok {
			return fmt.Errorf("processor with the key %s already exists", processorKey)
		}
		userFlow.AddProcessor(processorKey, processor)
	}
	return nil
}

func (sfr *SystemFlowRepresentation) storeProcessors(
	processors map[string]publictypes.ProcessorDataI,
) error {
	for processorKey, processor := range processors {
		if _, ok := sfr.processors[processorKey]; ok {
			return fmt.Errorf("processor with the key %s already exists", processorKey)
		}
		sfr.processors[processorKey] = processor
	}
	return nil
}

func (sfr *SystemFlowRepresentation) addProcessorConnection(
	processorsConnections publictypes.ResourceFlowI,
) {
	log.Trace().Msg("Adding processor connections to request")
	log.Trace().Msgf("Current request links at start %v", sfr.resourceFlow.GetRequest().GetStart())
	log.Trace().Msgf("Current request links at end %v", sfr.resourceFlow.GetRequest().GetEnd())
	reqLink := processorsConnections.GetRequest()
	sfr.resourceFlow.GetRequest().AddConnections(reqLink)
	log.Trace().Msgf("Updated request links at start %v", sfr.resourceFlow.GetRequest().GetStart())
	log.Trace().Msgf("Updated request links at end %v", sfr.resourceFlow.GetRequest().GetEnd())

	log.Trace().Msgf("Adding processor connections to response")
	log.Trace().Msgf("Current response links at start %v", sfr.resourceFlow.GetResponse().GetStart())
	log.Trace().Msgf("Current response links at end %v", sfr.resourceFlow.GetResponse().GetEnd())
	resLink := processorsConnections.GetResponse()
	sfr.resourceFlow.GetResponse().AddConnections(resLink)
	log.Trace().Msgf("Updated response links at start %v", sfr.resourceFlow.GetResponse().GetStart())
	log.Trace().Msgf("Updated response links at end %v", sfr.resourceFlow.GetResponse().GetEnd())
}

func (sfr *SystemFlowRepresentation) getLinkToUserProcessor(
	userFlow []internaltypes.FlowConnRepI,
	linkedAt string,
) internaltypes.ConnectionRepI {
	for _, conn := range userFlow {
		switch linkedAt {
		case publictypes.StreamStart:
			if !utils.IsInterfaceNil(conn.GetFrom().GetStream()) &&
				conn.GetFrom().GetStream().GetAt() == linkedAt {
				return conn.GetTo()
			}
		case publictypes.StreamEnd:
			if !utils.IsInterfaceNil(conn.GetTo().GetStream()) &&
				conn.GetTo().GetStream().GetAt() == linkedAt {
				return conn.GetFrom()
			}
		}
	}
	return nil
}

func (sfr *SystemFlowRepresentation) getProcessorsByType(
	flowType publictypes.StreamType,
	connectedAt string,
) []string {
	if flowType == publictypes.StreamTypeRequest {
		if connectedAt == publictypes.StreamStart {
			return sfr.resourceFlow.GetRequest().GetStart()
		} else if connectedAt == publictypes.StreamEnd {
			return sfr.resourceFlow.GetRequest().GetEnd()
		}
	}
	if flowType == publictypes.StreamTypeResponse {
		if connectedAt == publictypes.StreamStart {
			return sfr.resourceFlow.GetResponse().GetStart()
		} else if connectedAt == publictypes.StreamEnd {
			return sfr.resourceFlow.GetResponse().GetEnd()
		}
	}
	return []string{}
}

func (sfr *SystemFlowRepresentation) rewriteFlow(
	userFlow internaltypes.FlowRepI,
	modifiedConnections []internaltypes.FlowConnRepI,
	flowType publictypes.StreamType,
) {
	log.Trace().Msgf("Rewriting flow for %s", flowType)

	if flowType == publictypes.StreamTypeRequest {
		log.Trace().Msgf("Adding %s to user flow %+v", flowType, modifiedConnections)
		userFlow.GetFlow().SetRequest(modifiedConnections)
	}
	if flowType == publictypes.StreamTypeResponse {
		log.Trace().Msgf("Adding %s to user flow %+v", flowType, modifiedConnections)
		userFlow.GetFlow().SetResponse(modifiedConnections)
	}
}

func (sfr *SystemFlowRepresentation) appendSystemProcessorsToFlow(
	processors []string,
	flow []internaltypes.FlowConnRepI,
	currentConn *streamconfig.ProcessorRef,
	modifyAt string,
) *streamconfig.ProcessorRef {
	if modifyAt == publictypes.StreamEnd {
		for _, userConnection := range flow {
			if !utils.IsInterfaceNil(userConnection.GetTo().GetStream()) &&
				userConnection.GetTo().GetStream().GetAt() == publictypes.StreamEnd {
				userConnection.GetTo().SetProcessor(currentConn)
			}
		}
	}

	for _, processorKey := range processors {
		toConn := &streamconfig.ProcessorRef{
			Name: processorKey,
		}

		flow = append(flow, &streamconfig.FlowConnection{
			From: &streamconfig.Connection{
				Processor: currentConn,
			},
			To: &streamconfig.Connection{
				Processor: toConn,
			},
		})
		*currentConn = *toConn
	}
	return currentConn
}

func (sfr *SystemFlowRepresentation) GetFlowTemplate() internaltypes.FlowRepI {
	log.Trace().Msgf("Filter ID %v", sfr.filter.GetName())
	flowRep := &streamconfig.FlowRepresentation{
		Name: TemplateFlowName + sfr.systemFlowID,
		Flow: streamconfig.Flow{
			Request: []*streamconfig.FlowConnection{
				{
					From: &streamconfig.Connection{
						Stream: &streamconfig.StreamRef{
							Name: publictypes.GlobalStream,
							At:   publictypes.StreamStart,
						},
					},
					To: &streamconfig.Connection{
						Stream: &streamconfig.StreamRef{
							Name: publictypes.GlobalStream,
							At:   publictypes.StreamEnd,
						},
					},
				},
			},
			Response: []*streamconfig.FlowConnection{
				{
					From: &streamconfig.Connection{
						Stream: &streamconfig.StreamRef{
							Name: publictypes.GlobalStream,
							At:   publictypes.StreamStart,
						},
					},

					To: &streamconfig.Connection{
						Stream: &streamconfig.StreamRef{
							Name: publictypes.GlobalStream,
							At:   publictypes.StreamEnd,
						},
					},
				},
			},
		},
	}
	flowRep.SetFilter(sfr.filter)
	flowRep.SetProcessors(sfr.processors)
	return flowRep
}
