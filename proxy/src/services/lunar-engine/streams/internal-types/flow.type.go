package internaltypes

import (
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
)

const (
	FlowStart = "start"
	FlowEnd   = "end"
)

type FlowDirectionI interface {
	GetFlowType() publictypes.StreamType
	GetNode(name string) (FlowGraphNodeI, error)
	GetRoot() (EntryPointI, error)
	IsDefined() bool
}

type FlowI interface {
	GetFilter() publictypes.FilterI
	GetName() string
	GetType() FlowType
	GetExecutionContext() publictypes.LunarContextI
	GetResourceManagement() publictypes.ResourceManagementI
	CleanExecution()

	GetDirection(publictypes.StreamType) FlowDirectionI
	GetRequestDirection() FlowDirectionI
	GetResponseDirection() FlowDirectionI
	IsUserFlow() bool
}

type FlowGraphNodeI interface {
	GetFlowGraphName() string
	GetProcessorKey() string
	GetProcessor() streamtypes.Processor
	GetEdges() []ConnectionEdgeI
}

type ConnectionEdgeI interface {
	IsValid() bool

	IsNodeAvailable() bool
	IsStreamAvailable() bool
	IsFlowAvailable() bool

	GetCondition() string
	GetTargetNode() FlowGraphNodeI
	GetTargetStream() StreamRefI
	GetTargetFlow() FlowRefI
}

type EntryPointI interface {
	GetNode() FlowGraphNodeI
	GetStream() StreamRefI
	GetFlow() FlowRefI
	IsValid() bool
}
