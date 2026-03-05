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

func (fgb *graphNodeBuilder) buildNode(
	flowRepName string,
	processor internaltypes.ProcessorRefI,
) (*FlowGraphNode, error) {
	createdByFlow := flowRepName
	if processor.GetCreatedByFlow() != "" {
		createdByFlow = processor.GetCreatedByFlow()
	}

	proc, found := fgb.processorManager.GetProcessorInstance(createdByFlow, processor.GetName())
	if !found {
		return nil, fmt.Errorf("processor '%s' created by flow '%s' not found",
			processor.GetName(), createdByFlow)
	}
	return NewFlowGraphNode(flowRepName, processor.GetReferenceName(), proc)
}
