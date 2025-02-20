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

func generateRequestAndResponseList() []publictypes.StreamType {
	return []publictypes.StreamType{
		publictypes.StreamTypeRequest,
		publictypes.StreamTypeResponse,
	}
}

func (sfr *SystemFlowRepresentation) GenerateSystemFlowEnd() internaltypes.FlowRepI {
	log.Trace().Msgf("Generating GenerateSystemFlowEnd flow for %s", sfr.systemFlowID)
	return sfr.generateSystemFlow(generateRequestAndResponseList(), internaltypes.SystemFlowEnd)
}

func (sfr *SystemFlowRepresentation) GenerateSystemFlowStart() internaltypes.FlowRepI {
	log.Trace().Msgf("Generating GenerateSystemFlowStart flow for %s", sfr.systemFlowID)
	return sfr.generateSystemFlow(generateRequestAndResponseList(), internaltypes.SystemFlowStart)
}

func (sfr *SystemFlowRepresentation) generateSystemFlow(
	flowTypes []publictypes.StreamType,
	flowLocationType internaltypes.FlowType, // publictypes.StreamStart or publictypes.StreamEnd
) internaltypes.FlowRepI {
	systemFlow := sfr.GetFlowTemplate(flowLocationType)
	combinedProcessors := make(map[string]publictypes.ProcessorDataI)
	requestConnections := []internaltypes.FlowConnRepI{}
	responseConnections := []internaltypes.FlowConnRepI{}

	for _, flowType := range flowTypes {
		processorsToConnect := sfr.getProcessorsByType(flowType, flowLocationType)

		if len(processorsToConnect) == 0 {
			continue
		}

		for _, processorKey := range processorsToConnect {
			combinedProcessors[processorKey] = sfr.processors[processorKey]
		}

		currentConn := &streamconfig.ProcessorRef{
			Name:          processorsToConnect[0],
			ReferenceName: processorsToConnect[0],
		}

		flowConnections := []internaltypes.FlowConnRepI{
			&streamconfig.FlowConnection{
				From: &streamconfig.Connection{
					Stream: &streamconfig.StreamRef{
						Name: publictypes.GlobalStream,
						At:   publictypes.StreamStart,
					},
				},
				To: &streamconfig.Connection{
					Processor: currentConn,
				},
			},
		}

		currentConn = sfr.appendSystemProcessorsToFlow(
			processorsToConnect[1:],
			flowConnections,
			currentConn,
			publictypes.StreamStart,
		)

		flowConnections = append(flowConnections, &streamconfig.FlowConnection{
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

		if flowType == publictypes.StreamTypeRequest {
			requestConnections = append(requestConnections, flowConnections...)
		} else if flowType == publictypes.StreamTypeResponse {
			responseConnections = append(responseConnections, flowConnections...)
		}
	}

	if len(combinedProcessors) == 0 {
		return nil
	}
	systemFlow.SetProcessors(combinedProcessors)
	systemFlow.GetFlow().SetFlowConnections(publictypes.StreamTypeRequest, requestConnections)
	systemFlow.GetFlow().SetFlowConnections(publictypes.StreamTypeResponse, responseConnections)

	return systemFlow
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

func (sfr *SystemFlowRepresentation) getProcessorsByType(
	flowType publictypes.StreamType,
	connectedAt internaltypes.FlowType,
) []string {
	if flowType == publictypes.StreamTypeRequest {
		if connectedAt == internaltypes.SystemFlowStart {
			return sfr.resourceFlow.GetRequest().GetStart()
		}
		return sfr.resourceFlow.GetRequest().GetEnd()
	}
	if flowType == publictypes.StreamTypeResponse {
		if connectedAt == internaltypes.SystemFlowStart {
			return sfr.resourceFlow.GetResponse().GetStart()
		}
		return sfr.resourceFlow.GetResponse().GetEnd()
	}
	return []string{}
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
			Name:          processorKey,
			ReferenceName: processorKey,
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

func (sfr *SystemFlowRepresentation) GetFlowTemplate(
	locationType internaltypes.FlowType,
) internaltypes.FlowRepI {
	log.Trace().Msgf("Filter ID %v", sfr.filter.GetName())
	flowRep := &streamconfig.FlowRepresentation{
		Name: TemplateFlowName + sfr.systemFlowID + "_" + locationType.String(),
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
	flowRep.SetType(locationType)
	return flowRep
}
