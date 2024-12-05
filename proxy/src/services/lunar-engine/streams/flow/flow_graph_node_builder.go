package streamflow

import (
	"fmt"
	internaltypes "lunar/engine/streams/internal-types"
	"lunar/engine/streams/processors"
)

type graphNodeBuilder struct {
	flowReps         map[string]internaltypes.FlowRepI
	processorManager *processors.ProcessorManager
}

func newGraphNodeBuilder(
	flowReps map[string]internaltypes.FlowRepI,
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

	procConf, found := flowRep.GetProcessors()[processorKey]
	if !found {
		return nil, fmt.Errorf("processor %s not found in flow %s", processorKey, flowRepName)
	}

	proc, found := fgb.processorManager.GetProcessorInstance(processorKey)
	if !found {
		return nil, fmt.Errorf("processor not found %s", processorKey)
	}

	return NewFlowGraphNode(flowRepName, processorKey, procConf, proc)
}
