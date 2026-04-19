package utils

import (
	"encoding/json"
	"fmt"
	public_types "lunar/engine/streams/public-types"
	"lunar/engine/streams/stream"
	context_manager "lunar/toolkit-core/context-manager"
	"lunar/toolkit-core/jsonpath"
	"strings"
)

// BuildSharedMemoryKey builds a shared memory key based on json path key parts
// and a key prefix
func BuildSharedMemoryKey(
	keyPrefix string,
	keyPartDefinitions []string,
	apiStream public_types.APIStreamI,
) (string, error) {
	object := stream.AsObject(apiStream)

	keyParts := make([]string, 0, len(keyPartDefinitions))
	for _, part := range keyPartDefinitions {
		value, err := jsonpath.GetJSONPathValue(object, part)
		if err != nil {
			return "", err
		}
		// support query_param which stored as array
		if arr, ok := value.([]any); ok && len(arr) == 1 {
			value = arr[0]
		}
		keyPart := fmt.Sprintf("%v", value)
		if keyPart == "" {
			return "", fmt.Errorf("empty key part: %s", part)
		}
		keyParts = append(keyParts, keyPart)
	}

	cacheKey := fmt.Sprintf("%s_%s", keyPrefix, strings.Join(keyParts, "_"))

	return cacheKey, nil
}

type SharedMemoryTTLEntry struct {
	TTL         int64
	StorageTime int64
	Content     []byte
	alive       bool
}

func (e *SharedMemoryTTLEntry) IsAlive() bool {
	return e.alive
}

// BuildSharedMemoryTTLEntry builds a shared memory entry with a TTL and a response
func BuildSharedMemoryTTLEntry(ttl int64, response public_types.TransactionI) ([]byte, error) {
	responseJSON, err := response.ToJSON()
	if err != nil {
		return nil, err
	}

	entry := SharedMemoryTTLEntry{
		TTL:         ttl,
		StorageTime: context_manager.Get().GetClock().Now().UTC().Unix(),
		Content:     responseJSON,
		alive:       true,
	}

	entryJSON, err := json.Marshal(entry)
	if err != nil {
		return nil, err
	}
	return entryJSON, nil
}

// ParseSharedMemoryTTLEntry parses a shared memory entry and returns response and alive flag
func ParseSharedMemoryTTLEntry(entry []byte) (*SharedMemoryTTLEntry, error) {
	var parsedEntry SharedMemoryTTLEntry
	err := json.Unmarshal(entry, &parsedEntry)
	if err != nil {
		return nil, err
	}
	alive := parsedEntry.StorageTime+int64(parsedEntry.TTL) >
		context_manager.Get().GetClock().Now().UTC().Unix()

	parsedEntry.alive = alive

	return &parsedEntry, nil
}
