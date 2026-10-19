package streamflow

import (
	internalTypes "lunar/engine/streams/internal-types"
	lunarContext "lunar/engine/streams/lunar-context"
	"lunar/engine/streams/processors"
	publicTypes "lunar/engine/streams/public-types"
	"lunar/engine/streams/resources"
)

// Ensure interfaces are implemented
var _ internalTypes.FlowI = &Flow{}

type Flow struct {
	flowRep            internalTypes.FlowRepI        // Flow representation
	request            *FlowDirection                // Request FlowDirection
	response           *FlowDirection                // Response FlowDirection
	contextManager     *lunarContext.ContextManager  // Flow context manager
	resourceManagement *resources.ResourceManagement // Resource management
}

// NewFlow initializes and returns a new instance of a Flow
func NewFlow(
	nodeBuilder *graphNodeBuilder,
	flowRep internalTypes.FlowRepI,
	resourceManagement *resources.ResourceManagement,
) *Flow {
	return &Flow{
		flowRep:  flowRep,
		request:  NewFlowDirection(flowRep, publicTypes.StreamTypeRequest, nodeBuilder),
		response: NewFlowDirection(flowRep, publicTypes.StreamTypeResponse, nodeBuilder),
		contextManager: lunarContext.NewContextManager().
			WithFlowContext().
			WithTransactionalContext(),
		resourceManagement: resourceManagement,
	}
}

func (fl *Flow) GetResourceManagement() publicTypes.ResourceManagementI {
	return fl.resourceManagement
}

// GetFilter returns the filter for the flow.
func (fl *Flow) GetFilter() publicTypes.FilterI {
	return fl.flowRep.GetFilter()
}

// GetName returns the name of the flow.
func (fl *Flow) GetName() string {
	return fl.flowRep.GetName()
}

func (fl *Flow) GetType() internalTypes.FlowType {
	return fl.flowRep.GetType()
}

// GetExecutionContext returns the flow context.
func (fl *Flow) GetExecutionContext() publicTypes.LunarContextI {
	return fl.contextManager.GetLunarContext()
}

// CleanExecution cleans the flow execution.
func (fl *Flow) CleanExecution() {
	fl.contextManager.DestroyTransactionalContext()
	//... add here more cleanup logic
}

// GetRequestDirection returns the request FlowDirection.
func (fl *Flow) GetRequestDirection() internalTypes.FlowDirectionI {
	return fl.request
}

// GetResponseDirection returns the response FlowDirection.
func (fl *Flow) GetResponseDirection() internalTypes.FlowDirectionI {
	return fl.response
}

func (fl *Flow) GetDirection(streamType publicTypes.StreamType) internalTypes.FlowDirectionI {
	if streamType.IsRequestType() {
		return fl.GetRequestDirection()
	}
	return fl.GetResponseDirection()
}

// IsUserFlow returns true if the flow is a user flow.
func (fl *Flow) IsUserFlow() bool {
	return fl.flowRep.GetType() == internalTypes.UserFlow
}

// BuildFlows builds flows based on the provided FlowRepresentations.
// All flows are being added to the filter tree
func BuildFlows(
	filterTree internalTypes.FilterTreeI,
	flowReps map[string]internalTypes.FlowRepI,
	processorsManager *processors.ProcessorManager,
	resourceManagement *resources.ResourceManagement,
) error {
	flowBuilder := newFlowBuilder(filterTree, flowReps, processorsManager, resourceManagement)
	return flowBuilder.build()
}
