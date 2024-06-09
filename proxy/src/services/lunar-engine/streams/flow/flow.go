package streamflow

import (
	streamconfig "lunar/engine/streams/config"
	internaltypes "lunar/engine/streams/internal-types"
	"lunar/engine/streams/processors"
	streamtypes "lunar/engine/streams/types"
)

// Ensure interfaces are implemented
var _ internaltypes.FlowI = &Flow{}

type Flow struct {
	flowRep  *streamconfig.FlowRepresentation // Flow representation
	request  *FlowDirection                   // Request FlowDirection
	response *FlowDirection                   // Response FlowDirection
}

// NewFlow initializes and returns a new instance of a Flow
func NewFlow(nodeBuilder *graphNodeBuilder, flowRep *streamconfig.FlowRepresentation) *Flow {
	return &Flow{
		flowRep:  flowRep,
		request:  NewFlowDirection(flowRep, streamtypes.StreamTypeRequest, nodeBuilder),
		response: NewFlowDirection(flowRep, streamtypes.StreamTypeResponse, nodeBuilder),
	}
}

// GetFilter returns the filter for the flow.
func (fl *Flow) GetFilter() streamconfig.Filter {
	return fl.flowRep.Filters
}

// GetName returns the name of the flow.
func (fl *Flow) GetName() string {
	return fl.flowRep.Name
}

// GetRequestDirection returns the request FlowDirection.
func (fl *Flow) GetRequestDirection() internaltypes.FlowDirectionI {
	return fl.request
}

// GetResponseDirection returns the response FlowDirection.
func (fl *Flow) GetResponseDirection() internaltypes.FlowDirectionI {
	return fl.response
}

// BuildFlows builds flows based on the provided FlowRepresentations.
// All flows are being added to the filter tree
func BuildFlows(
	filterTree internaltypes.FilterTreeI,
	flowReps []*streamconfig.FlowRepresentation,
	processorsManager *processors.ProcessorManager,
) error {
	flowBuilder := newFlowBuilder(filterTree, flowReps, processorsManager)
	return flowBuilder.build()
}
