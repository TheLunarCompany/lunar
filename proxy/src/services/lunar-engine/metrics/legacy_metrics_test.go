package metrics

import (
	"lunar/engine/utils/environment"
	"lunar/shared-model/config"
	"os"
	"strings"
	"sync"
	"testing"

	sharedActions "lunar/shared-model/actions"

	sharedDiscovery "lunar/shared-model/discovery"

	"github.com/stretchr/testify/require"
)

// Mock data for testing
const mockJSON = `{
	"endpoints": {
		"GET:::test.com/api/resource": {
			"min_time": "2024-01-01T00:00:00Z",
			"max_time": "2024-01-01T00:01:00Z",
			"count": 42,
			"status_codes": {
				"200": 42
			},
			"average_duration": 1.5
		}
	}
}`

func TestNewLegacyMetricManager(t *testing.T) {
	// Test success scenario
	cleanup := createTempJSONFile(t, mockJSON)
	defer cleanup()

	manager, err := NewLegacyMetricManager(config.Exporters{})
	require.NoError(t, err)
	require.NotNil(t, manager)
	require.Equal(t, environment.GetDiscoveryStateLocation(), manager.filePath)
}

func TestReadAndParseJSONFile(t *testing.T) {
	cleanup := createTempJSONFile(t, mockJSON)
	defer cleanup()

	manager, err := NewLegacyMetricManager(config.Exporters{})
	require.NoError(t, err)

	data, _, err := manager.readAndParseJSONFile()
	require.NoError(t, err)
	require.NotNil(t, data)

	// Validate parsed data
	endpointKey := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "test.com/api/resource",
	}
	minTime, err := sharedActions.TimestampFromStringToInt64("2024-01-01T00:00:00Z")
	require.NoError(t, err)
	maxTime, err := sharedActions.TimestampFromStringToInt64("2024-01-01T00:01:00Z")
	require.NoError(t, err)
	expectedAgg := sharedDiscovery.EndpointAgg{
		MinTime:         minTime,
		MaxTime:         maxTime,
		Count:           42,
		AverageDuration: 1.5,
		StatusCodes: map[int]sharedDiscovery.Count{
			200: 42,
		},
	}
	require.Contains(t, data, endpointKey)
	require.Equal(t, expectedAgg, data[endpointKey])

	mockJSONNew := strings.Replace(mockJSON, "200", "429", 1)
	cleanup2 := createTempJSONFile(t, mockJSONNew)
	defer cleanup2()

	manager.filePath = environment.GetDiscoveryStateLocation()
	data, originalData, err := manager.readAndParseJSONFile()
	require.NoError(t, err)
	require.NotNil(t, data)

	require.Contains(t, originalData[endpointKey].StatusCodes, 200)
}

func TestReadAndParseJSONFile_FileNotFound(t *testing.T) {
	manager := &LegacyMetricManager{
		filePath: "nonexistent.json",
		mu:       sync.Mutex{},
	}

	data, _, err := manager.readAndParseJSONFile()
	require.Error(t, err)
	require.Nil(t, data)
}

func TestReadAndParseJSONFile_InvalidJSON(t *testing.T) {
	cleanup := createTempJSONFile(t, `{"invalid_json": }`)
	defer cleanup()

	manager, err := NewLegacyMetricManager(config.Exporters{})
	require.NoError(t, err)

	data, _, err := manager.readAndParseJSONFile()
	require.Error(t, err)
	require.Nil(t, data)
	require.Contains(t, err.Error(), "failed to unmarshal JSON data")
}

func TestReadAndParseJSONFile_Caching(t *testing.T) {
	cleanup := createTempJSONFile(t, mockJSON)
	defer cleanup()

	manager, err := NewLegacyMetricManager(config.Exporters{})
	require.NoError(t, err)

	// First read (should populate the cache)
	data, _, err := manager.readAndParseJSONFile()
	require.NoError(t, err)
	require.NotNil(t, data)

	// Second read (should use cached data because the mod time hasn't changed)
	dataCached, _, err := manager.readAndParseJSONFile()
	require.NoError(t, err)
	require.Equal(t, data, dataCached)
}

// Helper function to create a temporary JSON file for testing
func createTempJSONFile(t *testing.T, content string) (cleanup func()) {
	t.Helper()

	tmpFile, err := os.CreateTemp("", "test-*.json")
	require.NoError(t, err)
	_, err = tmpFile.Write([]byte(content))
	require.NoError(t, err)
	require.NoError(t, tmpFile.Close())

	prev := environment.SetDiscoveryStateLocation(tmpFile.Name())

	return func() {
		environment.SetDiscoveryStateLocation(prev)
		os.Remove(tmpFile.Name())
	}
}
