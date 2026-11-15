package metrics

import (
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/utils/environment"
	"os"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func TestNewMetricManager(t *testing.T) {
	originalPath := environment.GetMetricsConfigFilePath()
	defer environment.SetMetricsConfigFilePath(originalPath)

	tempFile, err := os.CreateTemp("", "metrics*.yaml")
	require.NoError(t, err)
	defer os.Remove(tempFile.Name())

	cleanup := createTempJSONFile(t, mockJSON)
	defer cleanup()

	yamlContent := `
system_metrics:
  - name: active_flows        
    description: "Number of active flows"
  - name: flow_invocations    
    description: "Number of flow invocations" 

general_metrics:
  label_value:
    - method
    - path
    - status
  metric_value:
    - name: api_call_count
      description: "Number of API calls"
    - name: api_call_size
      description: "Average size of API calls"    
`

	_, err = tempFile.WriteString(yamlContent)
	require.NoError(t, err)
	tempFile.Close()

	// Set the environment variable to the temporary file
	environment.SetMetricsConfigFilePath(tempFile.Name())

	manager, err := NewMetricManager()
	require.NoError(t, err)
	require.NotNil(t, manager)
	require.NotNil(t, manager.config)

	// Verify metrics
	require.NotEmpty(t, manager.config.SystemMetrics)
	hasSystemMetric := func(name Metric, description string) bool {
		for _, m := range manager.config.SystemMetrics {
			if m.Name == name && m.Description == description {
				return true
			}
		}
		return false
	}

	require.True(t, hasSystemMetric("active_flows", "Number of active flows"))
	require.True(t, hasSystemMetric("flow_invocations", "Number of flow invocations"))

	// Check GeneralMetrics
	require.NotEmpty(t, manager.config.GeneralMetrics.LabelValue)
	require.NotEmpty(t, manager.config.GeneralMetrics.MetricValue)

	hasGeneralMetric := func(name Metric) bool {
		for _, m := range manager.config.GeneralMetrics.MetricValue {
			if m.Name == name {
				return true
			}
		}
		return false
	}

	// Check for specific general metrics
	require.True(t, hasGeneralMetric("api_call_count"))
	require.True(t, hasGeneralMetric("api_call_size"))

	// Check for label values
	expectedLabels := []string{"method", "path", "status"}
	for _, label := range expectedLabels {
		require.Contains(t, manager.config.GeneralMetrics.LabelValue, label)
	}

	// Check if the metrics are initialized correctly
	require.NotNil(t, manager.apiCallMetricMng.apiCallCountObserver)

	raw, found := manager.metricObjects.Load(Metric("api_call_size"))
	require.True(t, found)
	require.NotNil(t, raw)

	raw, found = manager.metricObjects.Load(Metric("active_flows"))
	require.True(t, found)
	require.NotNil(t, raw)

	require.NotNil(t, manager.flowsInvocationsCounter)
}

func TestMetricManagerLoadConfigError(t *testing.T) {
	// Set the environment variable to a non-existent file
	environment.SetMetricsConfigFilePath("/path/to/nonexistent/file.yaml")

	// Attempt to create a new MetricManager
	manager, err := NewMetricManager()
	require.False(t, manager.metricManagerActive)
	require.Error(t, err)
	require.NotNil(t, manager)
}

func TestGetMetricsConfigFilePath(t *testing.T) {
	// Test with environment variable set
	expectedPath := "/custom/path/metrics.yaml"
	environment.SetMetricsConfigFilePath("/wrong/path/metrics.yaml")
	t.Setenv(environment.MetricsConfigFileDefaultPathEnvVar, expectedPath)

	path := environment.GetMetricsConfigFilePathOrDefault()
	require.Equal(t, expectedPath, path)

	// Test with environment variable unset
	environment.SetMetricsConfigFilePath("")

	path = environment.GetMetricsConfigFilePathOrDefault()
	require.Equal(t, expectedPath, path)
}

func TestMetricManagerUpdateMetricsForAPICall(t *testing.T) {
	// Create a temporary YAML file
	tempFile, err := os.CreateTemp("", "metrics_config_*.yaml")
	require.NoError(t, err)
	defer os.Remove(tempFile.Name())

	cleanup := createTempJSONFile(t, mockJSON)
	defer cleanup()

	yamlContent := `
general_metrics:
  label_value:
    - http_method
    - url
    - status_code
  metric_value:
    - name: api_call_count
      type: counter
    - name: api_call_size
      type: histogram
`
	_, err = tempFile.Write([]byte(yamlContent))
	require.NoError(t, err)
	tempFile.Close()

	// Set the environment variable to point to the temporary file
	_ = environment.SetMetricsConfigFilePath(tempFile.Name())
	defer os.Unsetenv(environment.MetricsConfigFilePathEnvVar)

	mm, err := NewMetricManager()
	require.NoError(t, err)

	// Create a mock APICallMetricsProviderI
	mockProvider := new(MockAPICallMetricsProviderI)

	// Set up expectations
	mockProvider.On("GetMethod").Return("GET")
	mockProvider.On("GetURL").Return("https://api.example.com/test")
	mockProvider.On("GetHost").Return("api.example.com")
	mockProvider.On("GetStrStatus").Return("200", nil)
	mockProvider.On("GetSize").Return(1024)
	mockProvider.On("GetID").Return("123")
	mockProvider.On("GetType").Return(publictypes.StreamTypeResponse)

	mm.UpdateMetricsProviderForAPICall(mockProvider)
}

// MockAPICallMetricsProviderI is a mock implementation of APICallMetricsProviderI
type MockAPICallMetricsProviderI struct {
	mock.Mock
}

func (m *MockAPICallMetricsProviderI) GetMethod() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockAPICallMetricsProviderI) GetURL() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockAPICallMetricsProviderI) GetHost() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockAPICallMetricsProviderI) GetStrStatus() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockAPICallMetricsProviderI) GetID() string {
	args := m.Called()
	return args.String(0)
}

func (m *MockAPICallMetricsProviderI) GetSize() int {
	args := m.Called()
	return args.Get(0).(int)
}

func (m *MockAPICallMetricsProviderI) GetType() publictypes.StreamType {
	args := m.Called()
	return args.Get(0).(publictypes.StreamType)
}

func (m *MockAPICallMetricsProviderI) GetHeaders() map[string]string {
	args := m.Called()
	return args.Get(0).(map[string]string)
}

func (m *MockAPICallMetricsProviderI) GetBody() string {
	args := m.Called()
	return args.String(0)
}
