package pathparamsresource_test

import (
	"lunar/engine/utils/environment"
	"os"
	"path/filepath"
	"testing"

	pathparamsresource "lunar/engine/streams/resources/path_params"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewPathParams(t *testing.T) {
	pp := pathparamsresource.NewPathParams()
	assert.NotNil(t, pp)
	assert.Nil(t, pp.GetPathParams())
}

func TestSetPathParams(t *testing.T) {
	pp := pathparamsresource.NewPathParams()
	err := pp.SetPathParams("/test/url")
	assert.NoError(t, err)
	pathParams := pp.GetPathParams()
	assert.Equal(t, 1, len(pathParams))
	assert.Equal(t, "/test/url", pathParams[0].URL)
}

func TestGeneratePathParamConfFile(t *testing.T) {
	pp := pathparamsresource.NewPathParams()
	err := pp.SetPathParams("/test/url")
	assert.NoError(t, err)

	err = pp.GeneratePathParamConfFile()
	assert.NoError(t, err)

	policiesPath, err := pathparamsresource.GetPathParamConfigPath()
	assert.NoError(t, err)

	_, err = os.Stat(policiesPath)
	assert.NoError(t, err)

	// Clean up
	os.Remove(policiesPath)
}

func TestLoadAndParsePathParamsFiles(t *testing.T) {
	tempDir := t.TempDir()
	testFilePath := filepath.Join(tempDir, "test_path_params.yaml")
	testYAMLContent := `
path_params:
    - url: "api.example.com/b/c"
`
	err := os.WriteFile(testFilePath, []byte(testYAMLContent), 0o644)
	assert.NoError(t, err)

	os.Setenv(environment.PathParamsDirectoryEnvVar, tempDir)
	defer os.Unsetenv(environment.PathParamsDirectoryEnvVar)

	pp := pathparamsresource.NewPathParams()
	pathParams := pp.GetPathParams()
	assert.Equal(t, 1, len(pathParams))
	assert.Equal(t, "api.example.com/b/c", pathParams[0].URL)
}

func TestDuplicatePathParamsFiles(t *testing.T) {
	tempDir := t.TempDir()

	testFilePath := filepath.Join(tempDir, "test_path_params.yaml")
	testYAMLContent := `
path_params:
    - url: "api.example.com/{myID}/c"
`
	err := os.WriteFile(testFilePath, []byte(testYAMLContent), 0o644)
	assert.NoError(t, err)

	os.Setenv(environment.PathParamsDirectoryEnvVar, tempDir)
	defer os.Unsetenv(environment.PathParamsDirectoryEnvVar)

	pp := pathparamsresource.NewPathParams()
	pathParams := pp.GetPathParams()
	assert.Equal(t, 1, len(pathParams))
	assert.Equal(t, "api.example.com/{myID}/c", pathParams[0].URL)

	err = pp.SetPathParams("api.example.com/{myID2}/c")
	require.Error(t, err)
}
