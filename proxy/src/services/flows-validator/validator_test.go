package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"lunar/engine/utils/environment"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	wd, err := os.Getwd()
	if err != nil {
		panic(err)
	}
	procPath := path.Join(path.Dir(wd), "lunar-engine/streams/processors")
	os.Setenv("LUNAR_PROXY_PROCESSORS_DIRECTORY", procPath)
	os.Setenv("LUNAR_SPOE_PROCESSING_TIMEOUT_SEC", "61")

	code := m.Run()
	os.RemoveAll(path.Join(".", DefaultRoot))
	os.Exit(code)
}

func TestGetValidatorPort(t *testing.T) {
	t.Run("Default Port", func(t *testing.T) {
		os.Unsetenv(ValidatorPortEnvVar)
		port := GetValidatorPort()
		require.Equal(t, DefaultPort, port)
	})

	t.Run("Custom Port", func(t *testing.T) {
		os.Setenv(ValidatorPortEnvVar, "9090")
		defer os.Unsetenv(ValidatorPortEnvVar)

		port := GetValidatorPort()
		require.Equal(t, "9090", port)
	})
}

func TestWriteBase64File(t *testing.T) {
	content := "test content"
	encoded := base64.StdEncoding.EncodeToString([]byte(content))
	tempFile := filepath.Join(os.TempDir(), "testfile.yaml")
	defer os.Remove(tempFile)

	err := writeBase64File(encoded, tempFile)
	require.NoError(t, err)

	data, err := os.ReadFile(tempFile)
	require.NoError(t, err)
	require.Equal(t, content, string(data))
}

func TestValidation(t *testing.T) {
	testCases := []struct {
		name          string
		testFolder    string
		useTestFolder bool // if true, the test folder will be used as the root folder
		validationFn  func(t *testing.T, input *ValidationInput, result *ValidationResult)
	}{
		{
			name:       "Valid",
			testFolder: "valid",
			validationFn: func(t *testing.T, input *ValidationInput, result *ValidationResult) {
				require.Len(t, input.Flows, 2)
				require.Len(t, input.PathParams, 1)
				require.Len(t, input.Quotas, 2)
				require.NotEmpty(t, input.GatewayConfig)

				require.True(t, result.Success, result.Message)
			},
		},
		{
			name:          "Valid with ready folder",
			testFolder:    "valid",
			useTestFolder: true,
			validationFn: func(t *testing.T, input *ValidationInput, result *ValidationResult) {
				require.Len(t, input.Flows, 0)
				require.Len(t, input.PathParams, 0)
				require.Len(t, input.Quotas, 0)
				require.Empty(t, input.GatewayConfig)

				require.NotEmpty(t, input.FolderPath)

				require.True(t, result.Success, result.Message)
			},
		},
		{
			name:       "Invalid queue processor configuration - queue ttl more than LUNAR_SPOE_PROCESSING_TIMEOUT_SEC",
			testFolder: "invalid-queue-processor-config",
			validationFn: func(t *testing.T, input *ValidationInput, result *ValidationResult) {
				require.Len(t, input.Flows, 2)
				require.Len(t, input.Quotas, 2)
				require.Len(t, input.PathParams, 0)
				require.Empty(t, input.GatewayConfig)

				require.False(t, result.Success, result.Message)
				require.Contains(t, result.Message, "processing timeout (1m1s) is less than queue TTL (2m0s)")
			},
		},
		{
			name:       "Invalid gateway configuration",
			testFolder: "invalid-gateway-config",
			validationFn: func(t *testing.T, input *ValidationInput, result *ValidationResult) {
				require.Len(t, input.Flows, 0)
				require.Len(t, input.Quotas, 0)
				require.Len(t, input.PathParams, 0)
				require.NotEmpty(t, input.GatewayConfig)

				require.False(t, result.Success, result.Message)
				require.Contains(t, result.Message, "failed to validate gateway config")
			},
		},
		{
			name:       "Invalid Quota",
			testFolder: "invalid-quota",
			validationFn: func(t *testing.T, input *ValidationInput, result *ValidationResult) {
				require.Len(t, input.Flows, 1)
				require.Len(t, input.Quotas, 1)
				require.Len(t, input.PathParams, 0)
				require.Empty(t, input.GatewayConfig)

				require.False(t, result.Success, result.Message)
			},
		},
		{
			name:       "Quota With Same Provider Across Multiple Files",
			testFolder: "quota-with-same-provider-across-multiple-files",
			validationFn: func(t *testing.T, input *ValidationInput, result *ValidationResult) {
				require.Len(t, input.Flows, 0)
				require.Len(t, input.Quotas, 2)
				require.Len(t, input.PathParams, 0)
				require.Empty(t, input.GatewayConfig)

				require.False(t, result.Success, result.Message)
			},
		},
		{
			name:       "Quota With Same Provider Across Multiple Files - Internal Filter",
			testFolder: "quota-with-same-provider-across-multiple-files-internal-filter",
			validationFn: func(t *testing.T, input *ValidationInput, result *ValidationResult) {
				require.Len(t, input.Flows, 0)
				require.Len(t, input.Quotas, 2)
				require.Len(t, input.PathParams, 0)
				require.Empty(t, input.GatewayConfig)

				require.False(t, result.Success, result.Message)
			},
		},
		{
			name:       "Invalid Flow - no request",
			testFolder: "no-request-section",
			validationFn: func(t *testing.T, input *ValidationInput, result *ValidationResult) {
				require.Len(t, input.Flows, 1)
				require.Len(t, input.Quotas, 0)
				require.Len(t, input.PathParams, 0)
				require.Empty(t, input.GatewayConfig)

				require.False(t, result.Success, result.Message)
			},
		},
		{
			name:       "Invalid Flow - no response",
			testFolder: "no-response-section",
			validationFn: func(t *testing.T, input *ValidationInput, result *ValidationResult) {
				require.Len(t, input.Flows, 1)
				require.Len(t, input.Quotas, 0)
				require.Len(t, input.PathParams, 0)
				require.Empty(t, input.GatewayConfig)

				require.False(t, result.Success, result.Message)
			},
		},
		{
			name:       "Invalid flow yaml",
			testFolder: "invalid-yaml-flow",
			validationFn: func(t *testing.T, input *ValidationInput, result *ValidationResult) {
				require.Len(t, input.Flows, 1)
				require.Len(t, input.Quotas, 0)
				require.Len(t, input.PathParams, 0)
				require.Empty(t, input.GatewayConfig)

				require.False(t, result.Success, result.Message)
			},
		},
		{
			name:       "Invalid quota with no filter",
			testFolder: "quota-with-no-filter",
			validationFn: func(t *testing.T, input *ValidationInput, result *ValidationResult) {
				require.Len(t, input.Flows, 0)
				require.Len(t, input.Quotas, 1)
				require.Len(t, input.PathParams, 0)
				require.Empty(t, input.GatewayConfig)

				require.False(t, result.Success, result.Message)
			},
		},
		{
			name:       "Invalid flow - invalid processor",
			testFolder: "flow-with-invalid-processor",
			validationFn: func(t *testing.T, input *ValidationInput, result *ValidationResult) {
				require.Len(t, input.Flows, 2)
				require.Len(t, input.Quotas, 2)
				require.Len(t, input.PathParams, 0)
				require.Empty(t, input.GatewayConfig)

				require.False(t, result.Success, result.Message)
				require.Contains(t, result.Message, "failed to create processor")
			},
		},
		{
			name:       "Invalid flow - processor with duplicate keys",
			testFolder: "flow-with-processor-duplicate-params",
			validationFn: func(t *testing.T, input *ValidationInput, result *ValidationResult) {
				require.Len(t, input.Flows, 2)
				require.Len(t, input.Quotas, 2)
				require.Len(t, input.PathParams, 0)
				require.Empty(t, input.GatewayConfig)

				require.False(t, result.Success, result.Message)
				require.Contains(t,	result.Message, "duplicate key")
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			testFolder := filepath.Join("test-cases", tc.testFolder)

			var input *ValidationInput
			if tc.useTestFolder {
				input = &ValidationInput{
					FolderPath: testFolder,
				}
			} else {
				input = loadTestCase(t, testFolder)
			}

			body, err := json.Marshal(input)
			require.NoError(t, err)

			req := httptest.NewRequest(http.MethodPost, "/validate-flows", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			validateFlowsHandler(w, req)
			resp := w.Result()
			defer resp.Body.Close()

			require.Equal(t, http.StatusOK, resp.StatusCode)

			var result ValidationResult
			err = json.NewDecoder(resp.Body).Decode(&result)
			require.NoError(t, err)

			tc.validationFn(t, input, &result)
		})
	}
}

func loadTestCase(t *testing.T, testFolder string) *ValidationInput {
	valInput := &ValidationInput{}
	valInput.Flows = loadFiles(t, testFolder, environment.FlowsFolder)
	valInput.PathParams = loadFiles(t, testFolder, environment.PathParamsFolder)
	valInput.Quotas = loadFiles(t, testFolder, environment.QuotasFolder)

	gatewayConfig, _ := os.ReadFile(environment.GetCustomGatewayConfigPath(testFolder))
	if len(gatewayConfig) != 0 {
		valInput.GatewayConfig = base64.StdEncoding.EncodeToString(gatewayConfig)
	}

	return valInput
}

func loadFiles(t *testing.T, root, subFolder string) []string {
	dirEntries, err := os.ReadDir(filepath.Join(root, subFolder))
	if err != nil {
		return nil
	}
	var files []string
	for _, entry := range dirEntries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".yaml") {
			continue
		}

		content, err := os.ReadFile(filepath.Join(root, subFolder, entry.Name()))
		require.NoError(t, err)

		// Convert the content to Base64
		encoded := base64.StdEncoding.EncodeToString(content)
		files = append(files, encoded)
	}
	return files
}
