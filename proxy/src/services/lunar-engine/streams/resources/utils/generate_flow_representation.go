package resourceutils

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	publictypes "lunar/engine/streams/public-types"
	resourcetypes "lunar/engine/streams/resources/types"

	"github.com/rs/zerolog/log"
)

const (
	templateFlowName = "SystemFlow_"
)

type SystemFlowRepresentation struct {
	processors             map[string]streamconfig.Processor
	resourceFlow           publictypes.ResourceFlowI
	filter                 *streamconfig.Filter
	systemFlowID           string
	isReferencedByUsedFlow bool
}

func NewSystemFlowRepresentation() *SystemFlowRepresentation {
	return &SystemFlowRepresentation{
		processors: make(map[string]streamconfig.Processor),
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

func (sfr *SystemFlowRepresentation) GetFilter() *streamconfig.Filter {
	return sfr.filter
}

func (sfr *SystemFlowRepresentation) AddSystemFlow(
	resourceFlow *resourcetypes.ResourceFlowData,
) error {
	log.Trace().Msgf("Adding system flow %v", resourceFlow)
	sfr.filter = resourceFlow.Filter
	sfr.systemFlowID = resourceFlow.GetID()
	processors := make(map[string]*streamconfig.Processor)
	for processorKey, processor := range resourceFlow.GetProcessors() {
		processors[processorKey] = processor.(*streamconfig.Processor)
	}

	if err := sfr.storeProcessors(processors); err != nil {
		return err
	}
	sfr.addProcessorConnection(resourceFlow.GetProcessorsConnections())
	return nil
}

func (sfr *SystemFlowRepresentation) GenerateStandaloneFlow() *streamconfig.FlowRepresentation {
	log.Trace().Msgf("Generating standalone flow for %s", sfr.filter.GetName())
	systemFlow := sfr.GetFlowTemplate()
	sfr.linkSystemFlow(systemFlow, publictypes.StreamTypeRequest)
	sfr.linkSystemFlow(systemFlow, publictypes.StreamTypeResponse)
	log.Trace().Msgf("Generated standalone flow %v", systemFlow.Flow)
	for key, val := range systemFlow.Flow.Request {
		log.Trace().Msgf("Request %d %v", key, val)
	}
	for key, val := range systemFlow.Flow.Response {
		log.Trace().Msgf("Response %d %v", key, val)
	}
	log.Trace().Msgf("Generated standalone Processors %v", systemFlow.Processors)
	return systemFlow
}

func (sfr *SystemFlowRepresentation) AddSystemFlowToUserFlow(
	userFlow *streamconfig.FlowRepresentation,
) (*streamconfig.FlowRepresentation, error) {
	sfr.isReferencedByUsedFlow = true
	log.Trace().Msgf("Adding system flow to user flow %s", userFlow.Name)
	if err := sfr.addProcessorsToUserFlow(userFlow); err != nil {
		return nil, err
	}

	sfr.linkSystemFlow(userFlow, publictypes.StreamTypeRequest)
	sfr.linkSystemFlow(userFlow, publictypes.StreamTypeResponse)

	return userFlow, nil
}

func (sfr *SystemFlowRepresentation) linkSystemFlow(
	userFlow *streamconfig.FlowRepresentation,
	flowType publictypes.StreamType,
) {
	log.Trace().Msgf("Linking system flow to flow %s", userFlow.Name)
	flowConnection := sfr.getFlowByType(userFlow, flowType)
	processorsToConnect := sfr.getProcessorsByType(flowType, publictypes.StreamStart)

	if len(processorsToConnect) == 0 {
		sfr.rewriteFlow(userFlow, sfr.linkSystemFlowEnd(flowConnection, flowType), flowType)
		return
	}

	currentConn := &streamconfig.ProcessorRef{
		Name: processorsToConnect[0],
	}

	var newFlow []*streamconfig.FlowConnection
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
		To: connectionLink,
	})

	if connectionLink.Stream == nil {
		newFlow = append(newFlow, flowConnection[1:]...)
	}

	sfr.rewriteFlow(userFlow, sfr.linkSystemFlowEnd(newFlow, flowType), flowType)
}

func (sfr *SystemFlowRepresentation) linkSystemFlowEnd(
	flowConnection []*streamconfig.FlowConnection,
	flowType publictypes.StreamType,
) []*streamconfig.FlowConnection {
	log.Trace().Msg("Closing system flow on the flow")
	processorsToConnect := sfr.getProcessorsByType(flowType, publictypes.StreamEnd)

	if len(processorsToConnect) == 0 {
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
	userFlow *streamconfig.FlowRepresentation,
) error {
	for processorKey, processor := range sfr.processors {
		if _, ok := userFlow.Processors[processorKey]; ok {
			return fmt.Errorf("processor with the key %s already exists", processorKey)
		}
		userFlow.Processors[processorKey] = processor
	}
	return nil
}

func (sfr *SystemFlowRepresentation) storeProcessors(
	processors map[string]*streamconfig.Processor,
) error {
	for processorKey, processor := range processors {
		if _, ok := sfr.processors[processorKey]; ok {
			return fmt.Errorf("processor with the key %s already exists", processorKey)
		}
		sfr.processors[processorKey] = *processor
	}
	return nil
}

func (sfr *SystemFlowRepresentation) addProcessorConnection(
	processorsConnections publictypes.ResourceFlowI,
) {
	sfr.resourceFlow.GetRequest().AddConnections(processorsConnections.GetRequest())
	sfr.resourceFlow.GetResponse().AddConnections(processorsConnections.GetResponse())
}

func (sfr *SystemFlowRepresentation) getLinkToUserProcessor(
	userFlow []*streamconfig.FlowConnection,
	linkedAt string,
) *streamconfig.Connection {
	for _, conn := range userFlow {
		switch linkedAt {
		case publictypes.StreamStart:
			if conn.From.Stream != nil && conn.From.Stream.At == linkedAt {
				return conn.To
			}
		case publictypes.StreamEnd:
			if conn.To.Stream != nil && conn.To.Stream.At == linkedAt {
				return conn.From
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
		if connectedAt == publictypes.StreamStart && len(sfr.resourceFlow.GetRequest().GetStart()) > 0 {
			return sfr.resourceFlow.GetRequest().GetStart()
		} else if connectedAt == publictypes.StreamEnd &&
			len(sfr.resourceFlow.GetRequest().GetEnd()) > 0 {
			return sfr.resourceFlow.GetRequest().GetEnd()
		}
	}
	if flowType == publictypes.StreamTypeResponse {
		if connectedAt == publictypes.StreamStart && len(sfr.resourceFlow.GetResponse().GetStart()) > 0 {
			return sfr.resourceFlow.GetResponse().GetStart()
		} else if connectedAt == publictypes.StreamEnd &&
			len(sfr.resourceFlow.GetResponse().GetEnd()) > 0 {
			return sfr.resourceFlow.GetResponse().GetEnd()
		}
	}
	return nil
}

func (sfr *SystemFlowRepresentation) getFlowByType(
	userFlow *streamconfig.FlowRepresentation,
	flowType publictypes.StreamType,
) []*streamconfig.FlowConnection {
	if flowType == publictypes.StreamTypeRequest {
		return userFlow.Flow.Request
	}
	if flowType == publictypes.StreamTypeResponse {
		return userFlow.Flow.Response
	}
	return nil
}

func (sfr *SystemFlowRepresentation) rewriteFlow(
	userFlow *streamconfig.FlowRepresentation,
	modifiedConnections []*streamconfig.FlowConnection,
	flowType publictypes.StreamType,
) {
	if flowType == publictypes.StreamTypeRequest {
		log.Trace().Msgf("Adding StreamTypeRequest to user flow %v", modifiedConnections)
		userFlow.Flow.Request = modifiedConnections
	}
	if flowType == publictypes.StreamTypeResponse {
		log.Trace().Msgf("Adding StreamTypeResponse to user flow %v", modifiedConnections)
		userFlow.Flow.Response = modifiedConnections
	}
}

func (sfr *SystemFlowRepresentation) appendSystemProcessorsToFlow(
	processors []string,
	flow []*streamconfig.FlowConnection,
	currentConn *streamconfig.ProcessorRef,
	modifyAt string,
) *streamconfig.ProcessorRef {
	if modifyAt == publictypes.StreamEnd {
		for _, userConnection := range flow {
			if userConnection.To.Stream != nil && userConnection.To.Stream.At == publictypes.StreamEnd {
				userConnection.To.Processor = currentConn
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

func (sfr *SystemFlowRepresentation) GetFlowTemplate() *streamconfig.FlowRepresentation {
	return &streamconfig.FlowRepresentation{
		Name:       templateFlowName + sfr.systemFlowID,
		Filters:    *sfr.filter,
		Processors: sfr.processors,
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
}
