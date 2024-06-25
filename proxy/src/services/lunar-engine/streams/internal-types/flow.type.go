package internaltypes

import (
	streamconfig "lunar/engine/streams/config"
	streamtypes "lunar/engine/streams/types"
)

const (
	FlowStart = "start"
	FlowEnd   = "end"
)

type FlowDirectionI interface {
	GetFlowType() streamtypes.StreamType
	GetNode(name string) (FlowGraphNodeI, error)
	GetRoot() (EntryPointI, error)
	IsDefined() bool
}

type FlowI interface {
	GetFilter() streamconfig.Filter
	GetName() string

	GetExecutionContext() streamtypes.LunarContextI
	CleanExecution()

	GetRequestDirection() FlowDirectionI
	GetResponseDirection() FlowDirectionI
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
	GetTargetStream() *streamconfig.StreamRef
	GetTargetFlow() *streamconfig.FlowRef
}

type EntryPointI interface {
	GetNode() FlowGraphNodeI
	GetStream() *streamconfig.StreamRef
	GetFlow() *streamconfig.FlowRef
	IsValid() bool
}
