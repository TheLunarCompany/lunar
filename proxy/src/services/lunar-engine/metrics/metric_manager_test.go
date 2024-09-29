package metrics

import (
	publictypes "lunar/engine/streams/public-types"
	"os"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/metric"
)

func TestNewMetricManager(t *testing.T) {
	originalPath := os.Getenv(metricsConfigFilePathEnvVar)
	defer os.Setenv(metricsConfigFilePathEnvVar, originalPath)

	tempFile, err := os.CreateTemp("", "metrics*.yaml")
	require.NoError(t, err)
	defer os.Remove(tempFile.Name())

	yamlContent := `
system_metrics:
  - name: request_duration_seconds
    type: histogram
    help: "Duration of HTTP requests in seconds"
  - name: requests_total
    type: counter
    help: "Total number of HTTP requests"
  - name: active_connections
    type: gauge
    help: "Current number of active HTTP connections"

general_metrics:
  label_value:
    - method
    - path
    - status
  metric_value:
    - name: request_body_size
      type: histogram
      help: "Size of request bodies in bytes"
    - name: response_body_size
      type: histogram
      help: "Size of response bodies in bytes"
    - name: request_header_size
      type: histogram
      help: "Size of request headers in bytes"
    - name: response_header_size
      type: histogram
      help: "Size of response headers in bytes"
`

	_, err = tempFile.WriteString(yamlContent)
	require.NoError(t, err)
	tempFile.Close()

	// Set the environment variable to the temporary file
	os.Setenv(metricsConfigFilePathEnvVar, tempFile.Name())

	manager, err := NewMetricManager()
	require.NoError(t, err)
	require.NotNil(t, manager)
	require.NotNil(t, manager.config)

	// Verify metrics
	require.NotEmpty(t, manager.config.SystemMetrics)
	hasSystemMetric := func(name Metric, metricType string) bool {
		for _, m := range manager.config.SystemMetrics {
			if m.Name == name && string(m.Type) == metricType {
				return true
			}
		}
		return false
	}

	require.True(t, hasSystemMetric("request_duration_seconds", "histogram"))
	require.True(t, hasSystemMetric("requests_total", "counter"))
	require.True(t, hasSystemMetric("active_connections", "gauge"))

	// Check GeneralMetrics
	require.NotEmpty(t, manager.config.GeneralMetrics.LabelValue)
	require.NotEmpty(t, manager.config.GeneralMetrics.MetricValue)

	hasGeneralMetric := func(name Metric, metricType MetricType) bool {
		for _, m := range manager.config.GeneralMetrics.MetricValue {
			if m.Name == name && m.Type == metricType {
				return true
			}
		}
		return false
	}

	// Check for specific general metrics
	require.True(t, hasGeneralMetric("request_body_size", Histogram))
	require.True(t, hasGeneralMetric("response_body_size", Histogram))
	require.True(t, hasGeneralMetric("request_header_size", Histogram))
	require.True(t, hasGeneralMetric("response_header_size", Histogram))

	// Check for label values
	expectedLabels := []MetricLabel{"method", "path", "status"}
	for _, label := range expectedLabels {
		require.Contains(t, manager.config.GeneralMetrics.LabelValue, label)
	}

	// Check if the metrics are initialized correctly
	require.Len(t, manager.metricObjects, 7)
	require.NotNil(t, manager.metricObjects["requests_total"].(metric.Float64Counter))
	require.NotNil(t, manager.metricObjects["request_duration_seconds"].(metric.Float64Histogram))
	require.NotNil(t, manager.metricObjects["active_connections"].(metric.Float64ObservableGauge))
	require.NotNil(t, manager.metricObjects["request_body_size"].(metric.Float64Histogram))
	require.NotNil(t, manager.metricObjects["response_body_size"].(metric.Float64Histogram))
	require.NotNil(t, manager.metricObjects["request_header_size"].(metric.Float64Histogram))
	require.NotNil(t, manager.metricObjects["response_header_size"].(metric.Float64Histogram))
}

func TestMetricManagerLoadConfigError(t *testing.T) {
	// Set the environment variable to a non-existent file
	t.Setenv(metricsConfigFilePathEnvVar, "/path/to/nonexistent/file.yaml")

	// Attempt to create a new MetricManager
	manager, err := NewMetricManager()
	require.False(t, manager.metricManagerActive)
	require.Error(t, err)
	require.NotNil(t, manager)
}

func TestGetMetricsConfigFilePath(t *testing.T) {
	// Test with environment variable set
	expectedPath := "/custom/path/metrics.yaml"
	t.Setenv(metricsConfigFilePathEnvVar, "/wrong/path/metrics.yaml")
	t.Setenv(metricsConfigFileDefaultPathEnvVar, expectedPath)

	path, err := getMetricsConfigFilePath()
	require.NoError(t, err)
	require.Equal(t, expectedPath, path)

	// Test with environment variable unset
	t.Setenv(metricsConfigFilePathEnvVar, "")

	path, err = getMetricsConfigFilePath()
	require.NoError(t, err)
	require.Equal(t, expectedPath, path)
}

func TestMetricManagerUpdateMetricsForAPICall(t *testing.T) {
	// Create a temporary YAML file
	tempFile, err := os.CreateTemp("", "metrics_config_*.yaml")
	require.NoError(t, err)
	defer os.Remove(tempFile.Name())

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
	os.Setenv(metricsConfigFilePathEnvVar, tempFile.Name())
	defer os.Unsetenv(metricsConfigFilePathEnvVar)

	mm, err := NewMetricManager()
	require.NoError(t, err)

	// Create a mock APICallMetricsProviderI
	mockProvider := new(MockAPICallMetricsProviderI)

	// Set up expectations
	mockProvider.On("GetMethod").Return("GET")
	mockProvider.On("GetURL").Return("https://api.example.com/test")
	mockProvider.On("GetStrStatus").Return("200", nil)
	mockProvider.On("GetSize").Return(1024)
	mockProvider.On("GetID").Return("123")
	mockProvider.On("GetType").Return(publictypes.StreamTypeResponse)

	err = mm.UpdateMetricsForAPICall(mockProvider)
	require.NoError(t, err)
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

func (m *MockAPICallMetricsProviderI) GetStrStatus() (string, error) {
	args := m.Called()
	return args.String(0), args.Error(1)
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
