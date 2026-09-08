package metrics

import (
	"encoding/json"
	"fmt"
	"io"
	"lunar/engine/utils/environment"
	"os"
	"path/filepath"
	"sync"
	"time"

	sharedDiscovery "lunar/shared-model/discovery"
)

type discoveryStateParser struct {
	filePath string
	mu       sync.Mutex

	// cache will be used instead of reading json file - if the file hasn't changed
	lastModTime        time.Time
	cachedEndpointData map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg
	cachedConsumerData map[string]sharedDiscovery.EndpointMapping
}

type parsingResult struct {
	NewEndpointData      map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg
	OriginalEndpointData map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg

	NewConsumerData      map[string]sharedDiscovery.EndpointMapping
	OriginalConsumerData map[string]sharedDiscovery.EndpointMapping
}

func newDiscoveryStateParser() (*discoveryStateParser, error) {
	filePath := environment.GetDiscoveryStateLocation()
	if filePath == "" {
		return nil, fmt.Errorf("discovery state location not set")
	}

	return &discoveryStateParser{
		filePath: filePath,
		mu:       sync.Mutex{},
	}, nil
}

// readAndParseJSONFile reads and parses the JSON file
func (d *discoveryStateParser) ReadAndParseDiscovery() (*parsingResult, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	// Get the file's modification time
	fileInfo, err := os.Stat(d.filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat JSON file: %w", err)
	}
	modTime := fileInfo.ModTime()

	// Check if the file has changed since the last read
	if modTime.Equal(d.lastModTime) && d.cachedEndpointData != nil && d.cachedConsumerData != nil {
		return d.parsingResultFromCache(), nil
	}

	jsonFile, err := os.Open(filepath.Clean(d.filePath))
	if err != nil {
		return nil, fmt.Errorf("failed to open JSON file: %w", err)
	}
	defer jsonFile.Close()

	byteValue, err := io.ReadAll(jsonFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read JSON file: %w", err)
	}

	var discoveryOutput sharedDiscovery.Output
	err = json.Unmarshal(byteValue, &discoveryOutput)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON data: %w", err)
	}

	parsedEndpointData := sharedDiscovery.ConvertEndpointsFromPersisted(discoveryOutput.Endpoints)
	parsedConsumerData := sharedDiscovery.ConvertConsumersFromPersisted(discoveryOutput.Consumers)

	return d.parsingResult(modTime, parsedEndpointData, parsedConsumerData), nil
}

func (d *discoveryStateParser) parsingResult(
	modificationTime time.Time,
	newEndpointData map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg,
	newConsumerData map[string]sharedDiscovery.EndpointMapping,
) *parsingResult {
	// Update cache
	originalEndpointData := d.cachedEndpointData
	originalConsumerData := d.cachedConsumerData

	d.cachedEndpointData = newEndpointData
	d.cachedConsumerData = newConsumerData
	d.lastModTime = modificationTime

	return &parsingResult{
		NewEndpointData:      newEndpointData,
		OriginalEndpointData: originalEndpointData,

		NewConsumerData:      newConsumerData,
		OriginalConsumerData: originalConsumerData,
	}
}

func (d *discoveryStateParser) parsingResultFromCache() *parsingResult {
	return &parsingResult{
		NewEndpointData:      d.cachedEndpointData,
		OriginalEndpointData: d.cachedEndpointData,
		NewConsumerData:      d.cachedConsumerData,
		OriginalConsumerData: d.cachedConsumerData,
	}
}
