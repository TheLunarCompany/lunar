package streamflow

import (
	streamconfig "lunar/engine/streams/config"
	internaltypes "lunar/engine/streams/internal-types"
	"lunar/engine/streams/processors"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/streams/resources"
	streamtypes "lunar/engine/streams/types"
)

// Ensure interfaces are implemented
var _ internaltypes.FlowI = &Flow{}

type Flow struct {
	flowRep            *streamconfig.FlowRepresentation // Flow representation
	request            *FlowDirection                   // Request FlowDirection
	response           *FlowDirection                   // Response FlowDirection
	contextManager     *streamtypes.ContextManager      // Flow context manager
	resourceManagement *resources.ResourceManagement    // Resource management
}

// NewFlow initializes and returns a new instance of a Flow
func NewFlow(
	nodeBuilder *graphNodeBuilder,
	flowRep *streamconfig.FlowRepresentation,
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
func (fl *Flow) GetFilter() streamconfig.Filter {
	return fl.flowRep.Filters
}

// GetName returns the name of the flow.
func (fl *Flow) GetName() string {
	return fl.flowRep.Name
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

// BuildFlows builds flows based on the provided FlowRepresentations.
// All flows are being added to the filter tree
func BuildFlows(
	filterTree internaltypes.FilterTreeI,
	flowReps []*streamconfig.FlowRepresentation,
	processorsManager *processors.ProcessorManager,
	resourceManagement *resources.ResourceManagement,
) error {
	flowBuilder := newFlowBuilder(filterTree, flowReps, processorsManager, resourceManagement)
	return flowBuilder.build()
}
