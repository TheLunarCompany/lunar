package jsonpath

import (
	"encoding/json"
	"fmt"

	"github.com/ohler55/ojg/oj"
	"github.com/rs/zerolog/log"
)

func ParseData[T any](parseFrom T) (any, error) {
	var data interface{}
	var err error

	switch parseValue := any(parseFrom).(type) {
	case *string:
		data, err = ParseJSON(*parseValue)
		if err != nil {
			return nil, fmt.Errorf("failed to parse JSON from string: %w", err)
		}
	case *[]byte:
		data, err = ParseJSONBytes(*parseValue)
		if err != nil {
			return nil, fmt.Errorf("failed to parse JSON from bytes: %w", err)
		}
	default:
		data, err = ParseStruct(parseFrom)
		if err != nil {
			return nil, fmt.Errorf("failed to parse JSON from struct: %w", err)
		}
	}

	return data, nil
}

func ParseStruct[T any](obj T) (any, error) {
	jsonData, err := json.Marshal(obj)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal struct to JSON: %w", err)
	}

	log.Info().Msgf("jsonData: %s", jsonData)
	return ParseJSONBytes(jsonData)
}

func ParseJSON(jsonString string) (any, error) {
	return oj.ParseString(jsonString)
}

func ParseJSONBytes(jsonBytes []byte) (any, error) {
	return oj.Parse(jsonBytes)
}
