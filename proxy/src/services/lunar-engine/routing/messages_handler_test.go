package routing

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"lunar/engine/metrics"
	"lunar/engine/streams"
	stream_config "lunar/engine/streams/config"
	"lunar/engine/utils/environment"
	context_manager "lunar/toolkit-core/context-manager"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"testing"

	"github.com/negasus/haproxy-spoe-go/message"
	"github.com/negasus/haproxy-spoe-go/payload/kv"
	"github.com/negasus/haproxy-spoe-go/request"
	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	currentDir, err := os.Getwd()
	if err != nil {
		panic(err)
	}

	// Move one level up
	parentDir := filepath.Dir(currentDir)

	// Specify another folder in the parent directory
	processorsFolder := filepath.Join(parentDir, "streams", "processors", "registry")
	prevVal := environment.SetProcessorsDirectory(processorsFolder)

	os.Setenv("LUNAR_HEALTHCHECK_PORT", "8040")

	stopHAProxyMocks := startTestHaproxyEndpoints()
	defer stopHAProxyMocks()

	// Run the tests
	code := m.Run()

	// Clean up if necessary
	environment.SetProcessorsDirectory(prevVal)

	// Exit with the code from the tests
	os.Exit(code)
}

func TestCustomResponseReturnWhenContextIsClose(t *testing.T) {
	handlingDataManager := newTestHandlingDataManager(t)

	messageHandler := Handler(handlingDataManager)

	ctx, cancelCtx := signal.NotifyContext(context.Background(),
		os.Interrupt, os.Kill, syscall.SIGTTIN, syscall.SIGTERM)

	ctxMng := context_manager.Get()
	ctxMng.WithContext(ctx)
	cancelCtx() // We close the context here to simulate a closed context.

	keyValues := kv.NewKV()
	keyValues.Add("id", "test")
	keyValues.Add("sequence_id", "1")
	keyValues.Add("method", "GET")
	keyValues.Add("schema", "http")
	keyValues.Add("url", "a.b.c/d")
	keyValues.Add("path", "/d")
	keyValues.Add("query", "")
	keyValues.Add("headers", "")
	keyValues.Add("body", []byte(""))

	req := request.Request{
		Messages: &message.Messages{
			{
				Name: "lunar-on-request",
				KV:   keyValues,
			},
		},
	}
	messageHandler(&req)
	require.Equal(t, getShutdownActions(), req.Actions)
}

func TestConfigurationOps(t *testing.T) {
	handlingDataManager := newTestHandlingDataManager(t)

	flowContent := loadTestYAMLBase64(t, "flows/flow.yaml")
	quotaContent := loadTestYAMLBase64(t, "quotas/quota.yaml")
	pathParamsContent := loadTestYAMLBase64(t, "path_params/path_params.yaml")
	metricsContent := loadTestYAMLBase64(t, "metrics.yaml")
	gatewayConfigContent := loadTestYAMLBase64(t, "gateway_config.yaml")

	withTestConfigDirs(t, func() {
		handler := http.NewServeMux()
		handler.HandleFunc("/configuration", handlingDataManager.handleConfiguration())
		ts := httptest.NewServer(handler)
		defer ts.Close()

		// Test update operation
		payload := `{
			"operation": {
				"update": {
					"flows": {"flow.yaml": "` + flowContent + `"},
					"quotas": {"quota.yaml": "` + quotaContent + `"},
					"path_params": {"params.yaml": "` + pathParamsContent + `"},
					"metrics": "` + metricsContent + `",
					"gateway_config": "` + gatewayConfigContent + `"
				}
			}
		}`

		resp, err := http.Post(ts.URL+"/configuration", "application/json", strings.NewReader(payload))
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		// Test get operation
		respPayload := performGetRequest(t, ts)

		require.Len(t, respPayload.Get.Configurations, 1)
		current := respPayload.Get.Configurations[0]
		require.Equal(t, "lunar-proxy", current.Name)

		require.Equal(t, flowContent, current.Configuration.Flows["flow.yaml"])
		require.Equal(t, quotaContent, current.Configuration.Quotas["quota.yaml"])
		require.Equal(t, pathParamsContent, current.Configuration.PathParams["params.yaml"])
		require.Equal(t, metricsContent, current.Configuration.Metrics)
		require.Equal(t, gatewayConfigContent, current.Configuration.GatewayConfig)

		// Test delete operation
		payload = `{
			"operation": {
				"delete": {
					"flows": true,
					"quota_by_name": [
						"quota.yaml"
					]
				}
			}
		}`

		resp, err = http.Post(ts.URL+"/configuration", "application/json", strings.NewReader(payload))
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		respPayload = performGetRequest(t, ts)
		current = respPayload.Get.Configurations[0]
		require.Equal(t, "lunar-proxy", current.Name)

		require.NotContains(t, current.Configuration.Flows, "flow.yaml")
		require.NotContains(t, quotaContent, current.Configuration.Quotas, "quota.yaml")
		require.Equal(t, pathParamsContent, current.Configuration.PathParams["params.yaml"])
		require.Equal(t, metricsContent, current.Configuration.Metrics)
		require.Equal(t, gatewayConfigContent, current.Configuration.GatewayConfig)

		// Test get all operation
		respPayload = performGetAllRequest(t, ts, true)
		require.Len(t, respPayload.Get.Configurations, 3)
		require.True(t, strings.HasPrefix(respPayload.Get.Configurations[1].Name, "lunar-proxy-"))
		require.True(t, strings.HasPrefix(respPayload.Get.Configurations[2].Name, "lunar-proxy-"))

		checkpointToRestore := respPayload.Get.Configurations[1].Name

		// Test init operation
		payload = `{
			"operation": {
				"init": {}
			}
		}`

		resp, err = http.Post(ts.URL+"/configuration", "application/json", strings.NewReader(payload))
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		respPayload = performGetRequest(t, ts)
		current = respPayload.Get.Configurations[0]
		require.Equal(t, "lunar-proxy", current.Name)

		require.NotContains(t, current.Configuration.Flows, "flow.yaml")
		require.NotContains(t, quotaContent, current.Configuration.Quotas, "quota.yaml")
		require.NotContains(t, pathParamsContent, current.Configuration.PathParams, "params.yaml")
		require.NotEmpty(t, current.Configuration.Metrics)
		require.Empty(t, current.Configuration.GatewayConfig)

		// Test restore operation
		payload = `{
			"operation": {
				"restore": {
					"checkpoint": "` + checkpointToRestore + `"
				}
			}
		}`

		resp, err = http.Post(ts.URL+"/configuration", "application/json", strings.NewReader(payload))
		require.NoError(t, err)
		require.Equal(t, 200, resp.StatusCode)

		respPayload = performGetRequest(t, ts)
		current = respPayload.Get.Configurations[0]
		require.Equal(t, "lunar-proxy", current.Name)

		require.Equal(t, flowContent, current.Configuration.Flows["flow.yaml"])
		require.Equal(t, quotaContent, current.Configuration.Quotas["quota.yaml"])
		require.Equal(t, pathParamsContent, current.Configuration.PathParams["params.yaml"])
		require.Equal(t, metricsContent, current.Configuration.Metrics)
		require.Equal(t, gatewayConfigContent, current.Configuration.GatewayConfig)
	})
}

func performGetRequest(t *testing.T, ts *httptest.Server) *stream_config.ContractOperationResponse {
	return performGetAllRequest(t, ts, false)
}

func performGetAllRequest(t *testing.T, ts *httptest.Server, getAll bool) *stream_config.ContractOperationResponse {
	payload := `{
		"operation": {
			"get": {
				"all": ` + fmt.Sprintf("%t", getAll) + `
			}
		}
	}`

	resp, err := http.Post(ts.URL+"/configuration", "application/json", strings.NewReader(payload))
	require.NoError(t, err)
	require.Equal(t, 200, resp.StatusCode)

	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	return bodyToResponse(t, body)
}

func bodyToResponse(t *testing.T, body []byte) *stream_config.ContractOperationResponse {
	var jsonResp map[string]any
	err := json.Unmarshal(body, &jsonResp)
	require.NoError(t, err)

	err = json.Unmarshal([]byte(fmt.Sprintf("%v", jsonResp["data"])), &jsonResp)
	require.NoError(t, err)

	arr, err := json.Marshal(jsonResp["operation_response"])
	require.NoError(t, err)

	var respPayload stream_config.ContractOperationResponse
	err = json.Unmarshal(arr, &respPayload)
	require.NoError(t, err)

	return &respPayload
}

func withTestConfigDirs(t *testing.T, testFunc func()) {
	tempDir := t.TempDir()
	originalConfigRoot := environment.SetConfigRootDirectory(tempDir)
	originalConfigBackup := environment.SetConfigBackupDirectory(t.TempDir())
	originalFlows := environment.SetStreamsFlowsDirectory(filepath.Join(tempDir, "flows"))
	originalQuotas := environment.SetQuotasDirectory(filepath.Join(tempDir, "quotas"))
	originalPathParams := environment.SetPathParamsDirectory(filepath.Join(tempDir, "path_params"))
	originalGateway := environment.SetGatewayConfigPath(filepath.Join(tempDir, "gateway_config.yaml"))
	originalMetrics := environment.SetMetricsConfigFilePath(filepath.Join(tempDir, "metrics.yaml"))
	origMaxBackups := environment.SetConfigMaxBackups(3)

	os.Setenv("LUNAR_PROXY_METRICS_CONFIG_DEFAULT", filepath.Join("test_payload", "metrics.yaml"))

	testFunc()

	environment.SetConfigRootDirectory(originalConfigRoot)
	environment.SetConfigBackupDirectory(originalConfigBackup)
	environment.SetConfigMaxBackups(origMaxBackups)
	environment.SetStreamsFlowsDirectory(originalFlows)
	environment.SetQuotasDirectory(originalQuotas)
	environment.SetPathParamsDirectory(originalPathParams)
	environment.SetGatewayConfigPath(originalGateway)
	environment.SetMetricsConfigFilePath(originalMetrics)
}

func newTestHandlingDataManager(t *testing.T) *HandlingDataManager {
	handlingDataManager := NewHandlingDataManager(10, nil)
	handlingDataManager.isStreamsEnabled = true
	metricManager, err := metrics.NewMetricManager()
	require.Error(t, err)

	handlingDataManager.metricManager = metricManager

	err = initializeFlows(handlingDataManager)
	require.NoError(t, err)

	return handlingDataManager
}

func initializeFlows(handlingDataManager *HandlingDataManager) error {
	stream, err := streams.NewStream()
	if err != nil {
		return fmt.Errorf("failed to create stream: %w", err)
	}
	handlingDataManager.stream = stream

	if err = handlingDataManager.stream.Initialize(); err != nil {
		return fmt.Errorf("failed to initialize streams: %w", err)
	}

	return nil
}

func loadTestYAMLBase64(t *testing.T, relativePath string) string {
	path := filepath.Join("test_payload", relativePath)
	data, err := os.ReadFile(path)
	require.NoError(t, err, "failed to load test YAML from %s", path)
	return base64.StdEncoding.EncodeToString(data)
}

func startTestHaproxyEndpoints() (stop func()) {
	// Healthcheck server on port 8040
	healthcheckListener, err := net.Listen("tcp", "127.0.0.1:8040")
	if err != nil {
		panic(fmt.Sprintf("Failed to start healthcheck server: %v", err))
	}

	healthcheckServer := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path == "/healthcheck" && r.URL.RawQuery == "proxy_only=true" {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("OK")) //nolint:errcheck
			} else {
				http.NotFound(w, r)
			}
		}),
	}
	go healthcheckServer.Serve(healthcheckListener) //nolint:errcheck

	// Haproxy management server on port 10252
	managedListener, err := net.Listen("tcp", "127.0.0.1:10252")
	if err != nil {
		panic(fmt.Sprintf("Failed to start managed server: %v", err))
	}

	managementPaths := map[string]bool{
		"/managed_endpoint":      true,
		"/manage_all":            true,
		"/unmanage_all":          true,
		"/unmanage_global":       true,
		"/include_body_from":     true,
		"/include_body_from_all": true,
		"/capture_req_from":      true,
		"/capture_req_all":       true,
	}

	managedServer := &http.Server{
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if managementPaths[r.URL.Path] {
				w.WriteHeader(http.StatusOK)
				w.Write([]byte("ack")) //nolint:errcheck
			} else {
				http.NotFound(w, r)
			}
		}),
	}
	go managedServer.Serve(managedListener) //nolint:errcheck

	return func() {
		healthcheckServer.Close()
		managedServer.Close()
		healthcheckListener.Close()
		managedListener.Close()
	}
}
