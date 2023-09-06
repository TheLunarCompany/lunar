package configuration

import (
	"os"

	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v3"
)

func DecodeYAML[T any](path string) (*T, error) {
	data, readErr := os.ReadFile(path)
	if readErr != nil {
		return nil, readErr
	}

	return UnmarshalPolicyRawData[T](data)
}

func UnmarshalPolicyRawData[T any](data []byte) (*T, error) {
	if log.Debug().Enabled() {
		log.Debug().Msgf("Read raw YAML: %s", string(data))
	}

	var target T

	if unmarshalErr := yaml.Unmarshal(data, &target); unmarshalErr != nil {
		return nil, unmarshalErr
	}

	return &target, nil
}
