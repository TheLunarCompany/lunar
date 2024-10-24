package streamflow

import (
	internaltypes "lunar/engine/streams/internal-types"
	"lunar/engine/streams/processors"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/streams/resources"
	streamtypes "lunar/engine/streams/types"
)

// Ensure interfaces are implemented
var _ internaltypes.FlowI = &Flow{}

type Flow struct {
	flowRep            internaltypes.FlowRepI        // Flow representation
	request            *FlowDirection                // Request FlowDirection
	response           *FlowDirection                // Response FlowDirection
	contextManager     *streamtypes.ContextManager   // Flow context manager
	resourceManagement *resources.ResourceManagement // Resource management
}

// NewFlow initializes and returns a new instance of a Flow
func NewFlow(
	nodeBuilder *graphNodeBuilder,
	flowRep internaltypes.FlowRepI,
	resourceManagement *resources.ResourceManagement,
) *Flow {
	return &Flow{
		flowRep:  flowRep,
		request:  NewFlowDirection(flowRep, publictypes.StreamTypeRequest, nodeBuilder),
		response: NewFlowDirection(flowRep, publictypes.StreamTypeResponse, nodeBuilder),
		contextManager: streamtypes.NewContextManager().
			WithFlowContext().
			WithTransactionalContext(),
		resourceManagement: resourceManagement,
	}
}

func (fl *Flow) GetResourceManagement() publictypes.ResourceManagementI {
	return fl.resourceManagement
}

// GetFilter returns the filter for the flow.
func (fl *Flow) GetFilter() publictypes.FilterI {
	return fl.flowRep.GetFilter()
}

// GetName returns the name of the flow.
func (fl *Flow) GetName() string {
	return fl.flowRep.GetName()
}

func (fl *Flow) GetType() internaltypes.FlowType {
	return fl.flowRep.GetType()
}

// GetContext returns the flow context.
func (fl *Flow) GetExecutionContext() publictypes.LunarContextI {
	return fl.contextManager.GetLunarContext()
}

// CleanExecution cleans the flow execution.
func (fl *Flow) CleanExecution() {
	fl.contextManager.DestroyTransactionalContext()
	//... add here more cleanup logic
}

// GetRequestDirection returns the request FlowDirection.
func (fl *Flow) GetRequestDirection() internaltypes.FlowDirectionI {
	return fl.request
}

// GetResponseDirection returns the response FlowDirection.
func (fl *Flow) GetResponseDirection() internaltypes.FlowDirectionI {
	return fl.response
}

func (fl *Flow) GetDirection(streamType publictypes.StreamType) internaltypes.FlowDirectionI {
	if streamType.IsRequestType() {
		return fl.GetRequestDirection()
	}
	return fl.GetResponseDirection()
}

// IsUserFlow returns true if the flow is a user flow.
func (fl *Flow) IsUserFlow() bool {
	return fl.flowRep.GetType() == internaltypes.UserFlow
}

// BuildFlows builds flows based on the provided FlowRepresentations.
// All flows are being added to the filter tree
func BuildFlows(
	filterTree internaltypes.FilterTreeI,
	flowReps map[string]internaltypes.FlowRepI,
	processorsManager *processors.ProcessorManager,
	resourceManagement *resources.ResourceManagement,
) error {
	flowBuilder := newFlowBuilder(filterTree, flowReps, processorsManager, resourceManagement)
	return flowBuilder.build()
}
