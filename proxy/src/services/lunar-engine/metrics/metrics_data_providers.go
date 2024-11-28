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

type FlowMetricsProviderI interface {
	GetActiveFlows() int64
	GetFlowInvocations() int64
	GetRequestsThroughFlows() int64
	GetAvgFlowExecutionTime() float64
	GetAvgProcessorExecutionTime() float64
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

func (m *metricsProviderData) UpdateFlowData(provider FlowMetricsProviderI) {
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
