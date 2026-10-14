package metrics

import (
	publictypes "lunar/engine/streams/public-types"
	"sync"
)

type APICallMetricsProviderI interface {
	GetID() string
	GetType() publictypes.StreamType
	GetURL() string
	GetHost() string
	GetBody() string
	GetStrStatus() string
	GetMethod() string
	GetHeaders() map[string]string
	GetSize() int
}

type LabelSet struct {
	Host     string
	Method   string
	Consumer string
}

type FlowInvocationsData struct {
	FlowID string
	Labels *LabelSet
}

type RequestsThroughFlowData struct {
	StreamID string
	Labels   *LabelSet
}

type ProcData struct {
	AvgExecutionTime float64
}

type MetricData struct {
	ActiveFlows          []string
	FlowInvocations      *FlowInvocationsData
	AvgFlowExecutionTime map[string]float64   // key - flow ID
	ProcExecutionData    map[string]*ProcData // key - processor key
	RequestsThroughFlows *RequestsThroughFlowData
}

type FlowMetricsProviderI interface {
	GetAvgFlowExecutionTime() *MetricData
	GetProcessorExecutionData() *MetricData
	GetActiveFlows() *MetricData

	RegisterRequestsThroughFlowsObserver(func(*MetricData))
	RegisterFlowInvocationsObserver(func(*MetricData))
}

type metricsProviderData struct {
	callCount      int64
	avgAPICallSize float64

	latestFlowData FlowMetricsProviderI

	mu sync.RWMutex
}

func newMetricsProviderData() *metricsProviderData {
	return &metricsProviderData{}
}

func (m *metricsProviderData) UpdateAPICallData(provider APICallMetricsProviderI) {
	m.mu.Lock()
	defer m.mu.Unlock()

	size := float64(provider.GetSize())
	m.callCount++

	// Update the average incrementally
	m.avgAPICallSize = ((m.avgAPICallSize * float64(m.callCount-1)) + size) / float64(m.callCount)
}

func (m *metricsProviderData) UpdateFlowDataProvider(provider FlowMetricsProviderI) {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.latestFlowData = provider
}

func (m *metricsProviderData) GetFlowData() FlowMetricsProviderI {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.latestFlowData
}

func (m *metricsProviderData) GetAvgAPICallSize() float64 {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.avgAPICallSize
}
