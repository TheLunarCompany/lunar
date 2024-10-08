package metrics

import publictypes "lunar/engine/streams/public-types"

type APICallMetricsProviderI interface {
	GetID() string
	GetType() publictypes.StreamType
	GetURL() string
	GetBody() string
	GetStrStatus() string
	GetMethod() string
	GetHeaders() map[string]string
	GetSize() int
}

type FlowMetricsProviderI interface {
	GetActiveFlows() int64
	GetFlowInvocations() int64
	GetRequestsThroughFlows() int64
	GetAvgFlowExecutionTime() float64
	GetAvgProcessorExecutionTime() float64
}
