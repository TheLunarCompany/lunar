package internaltypes

import (
	publictypes "lunar/engine/streams/public-types"
	"lunar/toolkit-core/network"
)

type FlowType int

const (
	UserFlow FlowType = iota
	SystemFlowStart
	SystemFlowEnd
)

type FlowRepI interface {
	GetName() string
	GetType() FlowType
	GetFilter() publictypes.FilterI
	GetProcessors() map[string]publictypes.ProcessorDataI
	GetFlow() FlowGraphRepI
	GetData() network.ConfigurationPayload
	SetProcessors(map[string]publictypes.ProcessorDataI)
	SetFilter(publictypes.FilterI)
	SetType(FlowType)
	AddProcessor(string, publictypes.ProcessorDataI)
	SetID(string)
}

type FlowGraphRepI interface {
	GetRequest() []FlowConnRepI
	GetResponse() []FlowConnRepI
	GetFlowConnections(publictypes.StreamType) []FlowConnRepI
	SetRequest([]FlowConnRepI)
	SetResponse([]FlowConnRepI)
	SetFlowConnections(publictypes.StreamType, []FlowConnRepI) []FlowConnRepI
}

type FlowConnRepI interface {
	GetFrom() ConnectionRepI
	GetTo() ConnectionRepI
	SetTo(ConnectionRepI)
	SetFrom(ConnectionRepI)
}

type ConnectionRepI interface {
	GetStream() StreamRefI
	GetFlow() FlowRefI
	GetProcessor() ProcessorRefI
	SetStream(StreamRefI)
	SetFlow(FlowRefI)
	SetProcessor(ProcessorRefI)
}

type FlowRefI interface {
	GetName() string
	GetAt() string
}

type StreamRefI interface {
	GetName() string
	GetAt() string
}

type ProcessorRefI interface {
	GetName() string
	GetCondition() string
}
