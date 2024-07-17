package streamflow

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	"lunar/engine/streams/processors"
)

type graphNodeBuilder struct {
	flowReps         map[string]*streamconfig.FlowRepresentation
	processorManager *processors.ProcessorManager
}

func newGraphNodeBuilder(
	flowReps map[string]*streamconfig.FlowRepresentation,
	processorManager *processors.ProcessorManager,
) *graphNodeBuilder {
	return &graphNodeBuilder{
		flowReps:         flowReps,
		processorManager: processorManager,
	}
}

func (fgb *graphNodeBuilder) buildNode(flowRepName, processorKey string) (*FlowGraphNode, error) {
	flowRep, exists := fgb.flowReps[flowRepName]
	if !exists {
		return nil, fmt.Errorf("flow representation %s not found", flowRepName)
	}

	procConf, found := flowRep.Processors[processorKey]
	if !found {
		return nil, fmt.Errorf("processor %s not found in flow %s", processorKey, flowRepName)
	}

	proc, err := fgb.processorManager.CreateProcessor(&procConf)
	if err != nil {
		return nil, fmt.Errorf("failed to create processor %s: %w", processorKey, err)
	}

	return NewFlowGraphNode(flowRepName, processorKey, &procConf, proc)
}
