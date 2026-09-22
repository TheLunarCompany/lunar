package userdefinedtraces

import (
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"
	"os"
	"testing"
	"time"

	public_types "lunar/engine/streams/public-types"
	test_utils "lunar/engine/streams/test-utils"
	streamtypes "lunar/engine/streams/types"

	"github.com/stretchr/testify/require"
)

const (
	testConfig = "gateway_config.yaml"
)

func TestMain(m *testing.M) {
	prevVal := environment.SetGatewayConfigPath(testConfig)

	// Run the tests
	code := m.Run()

	// Clean up if necessary
	environment.SetGatewayConfigPath(prevVal)
	// Remove the test config file
	_ = os.Remove(testConfig)

	// Exit with the code from the tests
	os.Exit(code)
}

func TestUserDefinedProcessor(t *testing.T) {
	gatewayConfig := &environment.GatewayConfig{
		TraceExporter: environment.TraceExporter{
			TraceExporterID: "test-exporter",
			TracesEndpoint:  "http://tempo:4317",
		},
	}

	err := configuration.EncodeYAML(testConfig, gatewayConfig)
	require.NoError(t, err)

	t.Run("Initialization", func(t *testing.T) {
		metaData := createProcessorMetaData("test-processor", "test-exporter", nil)
		proc, err := NewProcessor(metaData)
		require.NoError(t, err)
		require.Equal(t, "test-processor", proc.GetName())
		require.True(t, proc.GetRequirement().IsBodyRequired)
	})

	t.Run("SuccessfulRequestTracing", func(t *testing.T) {
		metaData := createProcessorMetaData("test-processor", "test-exporter", map[string]string{
			"consumer_tag": "$.request.headers.x-lunar-consumer-tag",
		})
		proc, err := NewProcessor(metaData)
		require.NoError(t, err)

		// Mock request stream
		reqStream := test_utils.NewMockAPIStream(
			"https://example.com/api",
			map[string]string{"x-lunar-consumer-tag": "consumer123"},
			map[string]string{"Content-Type": "application/json"},
			`{"key": "value"}`,
			"",
		)
		reqStream.SetType(public_types.StreamTypeRequest)

		procIO, err := proc.Execute("test-flow", reqStream)
		require.NoError(t, err)
		require.NotNil(t, procIO.ReqAction)

		// Verify trace headers are injected
		headers := reqStream.GetHeaders()
		require.NotEmpty(t, headers["traceparent"], "traceparent header should be injected")
		require.NotEmpty(t, headers["b3"], "b3 header should be injected")
		require.Equal(t, "consumer123", headers["x-lunar-consumer-tag"], "x-lunar-consumer-tag should be preserved")
	})

	t.Run("SuccessfulResponseTracing", func(t *testing.T) {
		metaData := createProcessorMetaData("test-processor", "test-exporter", nil)
		proc, err := NewProcessor(metaData)
		require.NoError(t, err)

		// Mock request stream
		reqStream := test_utils.NewMockAPIStream(
			"https://example.com/api",
			map[string]string{},
			map[string]string{"Content-Type": "application/json"},
			`{"key": "value"}`,
			"",
		)
		reqStream.SetType(public_types.StreamTypeRequest)
		_, err = proc.Execute("test-flow", reqStream)
		require.NoError(t, err)

		// Mock response stream with same ID
		respStream := test_utils.NewMockAPIResponseStream(
			"https://example.com/api",
			map[string]string{"Content-Type": "application/json"},
			`{"status": "success"}`,
			200,
		)
		respStream.SetType(public_types.StreamTypeResponse)

		procIO, err := proc.Execute("test-flow", respStream)
		require.NoError(t, err)
		require.NotNil(t, procIO.RespAction)
	})

	t.Run("TraceContinuation", func(t *testing.T) {
		metaData := createProcessorMetaData("test-processor", "test-exporter", nil)
		proc, err := NewProcessor(metaData)
		require.NoError(t, err)

		// Mock request with existing traceparent
		reqStream := test_utils.NewMockAPIStream(
			"https://example.com/api",
			map[string]string{
				"traceparent": "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
			},
			map[string]string{"Content-Type": "application/json"},
			`{"key": "value"}`,
			"",
		)
		reqStream.SetType(public_types.StreamTypeRequest)

		procIO, err := proc.Execute("test-flow", reqStream)
		require.NoError(t, err)
		require.NotNil(t, procIO.ReqAction)

		// Verify new traceparent is different but related
		headers := reqStream.GetHeaders()
		newTraceParent := headers["traceparent"]
		require.NotEmpty(t, newTraceParent)
		require.NotEqual(t, "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01", newTraceParent)
	})

	t.Run("CustomAttributeExtraction", func(t *testing.T) {
		metaData := createProcessorMetaData("test-processor", "test-exporter", map[string]string{
			"user_id": "$.request.body.user_id",
		})
		proc, err := NewProcessor(metaData)
		require.NoError(t, err)

		reqStream := test_utils.NewMockAPIStream(
			"https://example.com/api",
			map[string]string{},
			map[string]string{"Content-Type": "application/json"},
			`{"user_id": "user456"}`,
			"",
		)
		reqStream.SetType(public_types.StreamTypeRequest)

		_, err = proc.Execute("test-flow", reqStream)
		require.NoError(t, err)
	})

	t.Run("ErrorResponse", func(t *testing.T) {
		metaData := createProcessorMetaData("test-processor", "test-exporter", nil)
		proc, err := NewProcessor(metaData)
		require.NoError(t, err)

		reqStream := test_utils.NewMockAPIStream(
			"https://example.com/api",
			map[string]string{},
			map[string]string{"Content-Type": "application/json"},
			`{"key": "value"}`,
			"",
		)
		reqStream.SetType(public_types.StreamTypeRequest)
		_, err = proc.Execute("test-flow", reqStream)
		require.NoError(t, err)

		respStream := test_utils.NewMockAPIResponseStream(
			"https://example.com/api",
			map[string]string{"Content-Type": "application/json"},
			`{"error": "bad request"}`,
			400,
		)
		respStream.SetType(public_types.StreamTypeResponse)

		procIO, err := proc.Execute("test-flow", respStream)
		require.NoError(t, err)
		require.NotNil(t, procIO.RespAction)
	})

	t.Run("ContextCleanup", func(t *testing.T) {
		metaData := createProcessorMetaData("test-processor", "test-exporter", nil)
		proc, err := NewProcessor(metaData)
		require.NoError(t, err)

		reqStream := test_utils.NewMockAPIStream(
			"https://example.com/api",
			map[string]string{},
			map[string]string{"Content-Type": "application/json"},
			`{"key": "value"}`,
			"",
		)
		reqStream.SetType(public_types.StreamTypeRequest)
		_, err = proc.Execute("test-flow", reqStream)
		require.NoError(t, err)

		udp := proc.(*userDefinedProcessor)
		require.NotEmpty(t, udp.activeContexts[reqStream.GetID()])

		// Simulate expiration by setting old timestamp
		udp.mu.Lock()
		udp.contextTimestamps[reqStream.GetID()] = time.Now().Add(-cleanTTL * 2)
		udp.mu.Unlock()

		// Wait for cleaner to run (shortened interval for testing)
		time.Sleep(cleanPeriod + 1*time.Second)

		udp.mu.Lock()
		_, exists := udp.activeContexts[reqStream.GetID()]
		udp.mu.Unlock()
		require.False(t, exists, "Context should be cleaned up")
	})
}

func createProcessorMetaData(name, exporterID string, customAttrs map[string]string) *streamtypes.ProcessorMetaData {
	params := make(map[string]streamtypes.ProcessorParam)
	params[exporterIDParam] = streamtypes.ProcessorParam{
		Name:  exporterIDParam,
		Value: public_types.NewParamValue(exporterID),
	}
	if customAttrs != nil {
		params[customTraceAttributesParam] = streamtypes.ProcessorParam{
			Name:  customTraceAttributesParam,
			Value: public_types.NewParamValue(customAttrs),
		}
	}
	return &streamtypes.ProcessorMetaData{
		Name:       name,
		Parameters: params,
	}
}
