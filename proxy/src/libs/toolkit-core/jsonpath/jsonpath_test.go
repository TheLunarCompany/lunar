package jsonpath_test

import (
	"encoding/json"
	"lunar/toolkit-core/jsonpath"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetJsonPathValue(t *testing.T) {
	expected := "test"
	jsonData := map[string]interface{}{
		"a": "test",
	}
	jsonPath := "$.a"
	actual, err := jsonpath.GetJSONPathValueAsType[string](jsonData, jsonPath)
	assert.Nil(t, err)
	assert.Equal(t, expected, actual)
}

func TestGetJsonPathValueWithMap(t *testing.T) {
	expected := "test"
	jsonData := map[string]interface{}{
		"a": map[string]interface{}{
			"b": "test",
		},
	}
	jsonPath := "$.a.b"
	actual, err := jsonpath.GetJSONPathValueAsType[string](jsonData, jsonPath)
	assert.Nil(t, err)
	assert.Equal(t, expected, actual)
}

func TestGetJsonPathValueWithRawJson(t *testing.T) {
	expected := "test"
	stringData := []byte(`{"b": "test"}`)
	unmarshalledData := map[string]interface{}{}
	err := json.Unmarshal(stringData, &unmarshalledData)
	assert.Nil(t, err)
	jsonData := map[string]interface{}{
		"a": unmarshalledData,
	}
	jsonPath := "$.a.b"
	actual, err := jsonpath.GetJSONPathValueAsType[string](jsonData, jsonPath)
	assert.Nil(t, err)
	assert.Equal(t, expected, actual)
}

func TestGetJsonPathValueFailsIfPathNotFound(t *testing.T) {
	jsonData := map[string]interface{}{
		"a": "test",
	}
	jsonPath := "$.b"
	_, err := jsonpath.GetJSONPathValueAsType[string](jsonData, jsonPath)
	assert.NotNil(t, err)
}

func TestGetJsonPathValueIsInt(t *testing.T) {
	want := 1
	jsonData := map[string]interface{}{
		"a": 1,
	}
	jsonPath := "$.a"
	actual, err := jsonpath.GetJSONPathValueAsType[int](jsonData, jsonPath)
	assert.Nil(t, err)
	assert.Equal(t, want, actual)
}

func TestGetJsonPathValueIsFloat(t *testing.T) {
	want := 1.1
	jsonData := map[string]interface{}{
		"a": 1.1,
	}
	jsonPath := "$.a"
	actual, err := jsonpath.GetJSONPathValueAsType[float64](jsonData, jsonPath)
	assert.Nil(t, err)
	assert.Equal(t, want, actual)
}

func TestGetJsonPathValueFailsIfTypeMismatch(t *testing.T) {
	jsonData := map[string]interface{}{
		"a": "test",
	}
	jsonPath := "$.a"
	_, err := jsonpath.GetJSONPathValueAsType[int](jsonData, jsonPath)
	assert.NotNil(t, err)
}

// The following test verifies that a JSON path with both dot and bracket notation works.
// Bracket notation is used to access keys with special characters, such as hyphens.
func TestMixedAccess(t *testing.T) {
	jsonData := map[string]interface{}{
		"headers": map[string]interface{}{
			"content-type":   "application/json",
			"content-length": "123",
		},
		"body": map[string]interface{}{
			"key": "value",
			"nestedKey": map[string]interface{}{
				"nestedKey2": 45,
			},
		},
	}
	jsonPath := `$.headers["content-length"]`
	value, err := jsonpath.GetJSONPathValueAsType[string](jsonData, jsonPath)
	assert.Nil(t, err)
	assert.Equal(t, "123", value)
}
