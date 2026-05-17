package configuration

import (
	"os"
	"reflect"

	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v3"
)

type YAMLResult[T any] struct {
	UnmarshaledData T
	Content         []byte
}

func DecodeYAML[T any](path string) (*YAMLResult[*T], error) {
	data, readErr := os.ReadFile(path)
	if readErr != nil {
		// If the file does not exist, return an empty object
		data = []byte{}
	}

	return UnmarshalPolicyRawData[T](data)
}

func EncodeYAML[T any](path string, data *T) error {
	yamlData, marshalErr := yaml.Marshal(data)
	if marshalErr != nil {
		log.Warn().Err(marshalErr).Msg("failed to marshal yaml")
		return marshalErr
	}

	if writeErr := os.WriteFile(path, yamlData, 0o644); writeErr != nil {
		log.Warn().Err(writeErr).Msg("failed to write yaml")
		return writeErr
	}
	return nil
}

// A function to deep copy an object via YAML serialization and deserialization.
// This is useful when you want to create a deep copy of an object in order to
// safely modify it without affecting the original object.
func YAMLBasedDeepCopy[T any](data *T) (*T, error) {
	yamlData, marshalErr := yaml.Marshal(data)
	if marshalErr != nil {
		log.Warn().Err(marshalErr).Msg("failed to marshal yaml")
		return nil, marshalErr
	}

	var copiedData T
	if unmarshalErr := yaml.Unmarshal(yamlData, &copiedData); unmarshalErr != nil {
		log.Warn().Err(unmarshalErr).Msg("failed to unmarshal yaml")
		return nil, unmarshalErr
	}
	return &copiedData, nil
}

func UnmarshalPolicyRawData[T any](data []byte) (*YAMLResult[*T], error) {
	if log.Trace().Enabled() {
		log.Trace().Msgf("Read raw YAML: %s", string(data))
	}
	result := YAMLResult[*T]{
		Content:         data,
		UnmarshaledData: nil,
	}

	if unmarshalErr := yaml.Unmarshal(data, &result.UnmarshaledData); unmarshalErr != nil {
		log.Warn().Err(unmarshalErr).Msg("failed to unmarshal yaml")
		return &result, unmarshalErr
	}
	if result.UnmarshaledData == nil {
		result.UnmarshaledData = reflect.New(reflect.TypeOf(result.UnmarshaledData).Elem()).
			Interface().(*T)
	}
	return &result, nil
}
