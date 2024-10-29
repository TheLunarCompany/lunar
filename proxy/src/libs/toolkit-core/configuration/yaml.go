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
