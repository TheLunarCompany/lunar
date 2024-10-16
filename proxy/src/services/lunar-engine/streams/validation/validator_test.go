package validation

import (
	"lunar/engine/utils/environment"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

type testCase struct {
	name    string
	modify  func(string) string
	wantErr bool
}

func TestMain(m *testing.M) {
	currentDir, err := os.Getwd()
	if err != nil {
		panic(err)
	}

	// Move one level up
	parentDir := filepath.Dir(currentDir)

	// Specify another folder in the parent directory
	processorsFolder := filepath.Join(parentDir, "processors", "registry")
	prevVal := environment.SetProcessorsDirectory(processorsFolder)

	// Run the tests
	code := m.Run()

	// Clean up if necessary
	environment.SetProcessorsDirectory(prevVal)

	// Exit with the code from the tests
	os.Exit(code)
}

func TestValidator_Valid(t *testing.T) {
	clean := setEnvironmentForTest("valid")
	defer clean()

	validator := NewValidator()
	err := validator.Validate()
	require.NoError(t, err)
}

func TestValidator_Quota_With_Only_Parent_Filter(t *testing.T) {
	clean := setEnvironmentForTest("quota-with-only-parent-filter")
	defer clean()

	validator := NewValidator()
	err := validator.Validate()
	require.NoError(t, err)
}

func TestValidator_Quota_With_No_Filter(t *testing.T) {
	clean := setEnvironmentForTest("quota-with-no-filter")
	defer clean()

	validator := NewValidator()
	err := validator.Validate()
	require.Error(t, err)
}

func TestValidator_Invalid_Missing_Request_Section(t *testing.T) {
	clean := setEnvironmentForTest("no-request-section")
	defer clean()

	validator := NewValidator()
	err := validator.Validate()
	require.Error(t, err)
}

func TestValidator_Invalid_Missing_Response_Section(t *testing.T) {
	clean := setEnvironmentForTest("no-response-section")
	defer clean()

	validator := NewValidator()
	err := validator.Validate()
	require.Error(t, err)
}

func TestValidator_InvalidYaml(t *testing.T) {
	clean := setEnvironmentForTest("invalid-yaml-flow")
	defer clean()

	// Path to the base YAML template file
	flowPath := filepath.Join("testing-environments", "invalid-yaml-flow", "flows")
	validFlowFile := filepath.Join(flowPath, "base_template")
	content, err := os.ReadFile(validFlowFile)
	require.NoError(t, err, "failed to read base YAML template file")

	baseYAMLTemplate := string(content)
	cases := []testCase{
		{
			name: "Indentation Error",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "stream:", "       stream:", 1)
			},
			wantErr: true,
		},
		{
			name: "Typo in Key",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "value:", "valu:", 1)
			},
			wantErr: true,
		},
		{
			name: "Missing Colon",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "processor: GenerateResponse", "processor GenerateResponse", 1)
			},
			wantErr: true,
		},
		{
			name: "Incorrect Field Name",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "flow:", "flw:", 1)
			},
			wantErr: true,
		},
		{
			name: "Duplicate Key",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "processor:\n          name: AllowFilter", "processor:\n          name: AllowFilter\n          name: AllowFilter", 1)
			},
			wantErr: true,
		},
		{
			name: "Unclosed Quotation Marks",
			modify: func(yaml string) string {
				return strings.Replace(yaml, `value: Forbidden Access`, `value: "Forbidden Access`, 1)
			},
			wantErr: true,
		},
		{
			name: "Missing Hyphen in List",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "- key: url", "key: url", 1)
			},
			wantErr: true,
		},
		{
			name: "Invalid Tab Character",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "  name:", "\tname:", 1) // Replace spaces with a tab
			},
			wantErr: true,
		},
		{
			name: "No Filter Specified",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "filter:\n  url: \"*\"\n", "", 1) // Remove the entire filter section
			},
			wantErr: true,
		},
		{
			name: "Global filter specified without quotation",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "filter:\n  url: \"*\"\n", "filter:\n  url: *\n", 1)
			},
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			flowFileWithErr := filepath.Join(flowPath, "error-flow.yaml")
			defer os.Remove(flowFileWithErr)

			// Modify YAML template to simulate the error
			yamlContent := tc.modify(baseYAMLTemplate)

			yamlContent = strings.Replace(yamlContent, "BaseTemplate", tc.name, 1)

			// Write the modified YAML to the temporary file
			err = os.WriteFile(flowFileWithErr, []byte(yamlContent), 0o644)
			require.NoError(t, err, "failed to write to temp file")

			validator := NewValidator()
			err = validator.Validate()

			if tc.wantErr {
				require.Error(t, err, "expected an error but got none")
			} else {
				require.NoError(t, err, "did not expect an error but got one")
			}
		})
	}
}

func TestValidator_Invalid_Quota(t *testing.T) {
	clean := setEnvironmentForTest("invalid-quota")
	defer clean()

	// Path to the base YAML template file
	quotasPath := filepath.Join("testing-environments", "invalid-quota", "quotas")
	validQuotaFile := filepath.Join(quotasPath, "base_template")
	content, err := os.ReadFile(validQuotaFile)
	require.NoError(t, err, "failed to read base YAML template file")

	baseYAMLTemplate := string(content)

	cases := []testCase{
		{
			name: "Missing Quota Section",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "quota:", "# quota section removed\n", 1)
			},
			wantErr: true,
		},
		{
			name: "Missing Internal Limits",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "internal_limits:", "# internal_limits removed\n", 1)
			},
			wantErr: true,
		},
		{
			name: "Invalid Max Quota Limit (Zero)",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "max: 3", "max: 0", 1) // (should be gt=0)
			},
			wantErr: true,
		},
		{
			name: "Invalid Day in Monthly Renewal",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "day: 10", "day: 32", 1) // (should be lte=31)
			},
			wantErr: true,
		},
		{
			name: "Invalid Hour in Monthly Renewal",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "hour: 5", "hour: 24", 1) //(should be lte=23)
			},
			wantErr: true,
		},
		{
			name: "Invalid Timezone",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "timezone: UTC", "timezone: Mars", 1) // (should be oneof=UTC Local)
			},
			wantErr: true,
		},
		{
			name: "Invalid Interval Unit",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "interval_unit: second", "interval_unit: years", 1) //(should be oneof=second minute hour day month)
			},
			wantErr: true,
		},
		{
			name: "Global filter specified without quotation",
			modify: func(yaml string) string {
				return strings.Replace(yaml, "url: \"*\"\n", "url: *\n", 1)
			},
			wantErr: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			quotaFileWithErr := filepath.Join(quotasPath, "error-quota.yaml")
			defer os.Remove(quotaFileWithErr)

			// Modify YAML template to simulate the error
			yamlContent := tc.modify(baseYAMLTemplate)

			// Write the modified YAML to the temporary file
			err = os.WriteFile(quotaFileWithErr, []byte(yamlContent), 0o644)
			require.NoError(t, err, "failed to write to temp file")

			validator := NewValidator()
			err = validator.Validate()

			if tc.wantErr {
				require.Error(t, err, "expected an error but got none")
			} else {
				require.NoError(t, err, "did not expect an error but got one")
			}
		})
	}
}

func setEnvironmentForTest(testCase string) (clean func()) {
	previousFlowsDir := environment.SetStreamsFlowsDirectory(filepath.Join("testing-environments", testCase, "flows"))
	previousQuotasDir := environment.SetQuotasDirectory(filepath.Join("testing-environments", testCase, "quotas"))
	previousPathParamsDir := environment.SetPathParamsDirectory(filepath.Join("testing-environments", testCase, "path_params"))

	return func() {
		environment.SetStreamsFlowsDirectory(previousFlowsDir)
		environment.SetQuotasDirectory(previousQuotasDir)
		environment.SetPathParamsDirectory(previousPathParamsDir)
	}
}
