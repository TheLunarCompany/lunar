package streamflow

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
)

type graphNodeBuilder struct {
	flowReps map[string]*streamconfig.FlowRepresentation
}

func newGraphNodeBuilder(flowReps map[string]*streamconfig.FlowRepresentation) *graphNodeBuilder {
	return &graphNodeBuilder{
		flowReps: flowReps,
	}
}

func (fgb *graphNodeBuilder) buildNode(flowRepName, processorKey string) (*FlowGraphNode, error) {
	flowRep, exists := fgb.flowReps[flowRepName]
	if !exists {
		return nil, fmt.Errorf("flow representation %s not found", flowRepName)
	}

	processor, ok := flowRep.Processors[processorKey]
	if !ok {
		return nil, fmt.Errorf("processor %s not found in flow %s", processorKey, flowRepName)
	}

	return NewFlowGraphNode(flowRepName, processorKey, processor)
}
