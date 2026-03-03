package metrics

import (
	publictypes "lunar/engine/streams/public-types"
	"testing"

	"github.com/stretchr/testify/require"
)

// Mock implementation of the APICallMetricsProviderI interface
type mockAPICallMetricsProvider struct {
	size int
}

func (m *mockAPICallMetricsProvider) GetID() string { return "" }
func (m *mockAPICallMetricsProvider) GetType() publictypes.StreamType {
	return publictypes.StreamTypeRequest
}
func (m *mockAPICallMetricsProvider) GetURL() string                        { return "" }
func (m *mockAPICallMetricsProvider) GetHost() string                       { return "" }
func (m *mockAPICallMetricsProvider) GetBody() string                       { return "" }
func (m *mockAPICallMetricsProvider) GetStrStatus() string                  { return "" }
func (m *mockAPICallMetricsProvider) GetMethod() string                     { return "" }
func (m *mockAPICallMetricsProvider) GetHeaders() map[string]string         { return nil }
func (m *mockAPICallMetricsProvider) GetSize() int                          { return m.size }
func (m *mockAPICallMetricsProvider) GetAvgProcessorExecutionTime() float64 { return 0 }
func (m *mockAPICallMetricsProvider) GetActiveFlows() int64                 { return 0 }
func (m *mockAPICallMetricsProvider) GetFlowInvocations() int64             { return 0 }
func (m *mockAPICallMetricsProvider) GetRequestsThroughFlows() int64        { return 0 }

func TestNewAPICallMetricsData(t *testing.T) {
	data := newMetricsProviderData()
	require.NotNil(t, data, "newAPICallMetricsData() should not return nil")
	require.Equal(t, float64(0), data.GetAvgAPICallSize(), "Initial average API call size should be 0")
}

func TestAPICallMetricsData_UpdateData(t *testing.T) {
	data := newMetricsProviderData()

	// Create mock providers
	provider1 := &mockAPICallMetricsProvider{size: 100}
	provider2 := &mockAPICallMetricsProvider{size: 300}

	// Update data with the first provider
	data.UpdateAPICallData(provider1)
	require.Equal(t, float64(100), data.GetAvgAPICallSize(), "Average API call size should be 100 after first update")

	// Update data with the second provider
	data.UpdateAPICallData(provider2)
	expectedAverage := (100.0 + 300.0) / 2
	require.Equal(t, expectedAverage, data.GetAvgAPICallSize(), "Average API call size should be updated correctly")
}

func TestAPICallMetricsData_Concurrency(t *testing.T) {
	data := newMetricsProviderData()

	// Create a mock provider
	provider := &mockAPICallMetricsProvider{size: 200}

	// Perform concurrent updates
	const numUpdates = 100
	done := make(chan bool, numUpdates)
	for i := 0; i < numUpdates; i++ {
		go func() {
			data.UpdateAPICallData(provider)
			done <- true
		}()
	}

	// Wait for all goroutines to complete
	for i := 0; i < numUpdates; i++ {
		<-done
	}

	// The average should stabilize to 200, as the same size is provided repeatedly
	require.Equal(t, float64(200), data.GetAvgAPICallSize(), "Concurrent updates should produce consistent average size")
}
