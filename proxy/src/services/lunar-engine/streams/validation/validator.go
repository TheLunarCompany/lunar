package validation

import (
	"fmt"
	"lunar/engine/streams"
	"lunar/engine/utils/environment"
	"os"

	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v2"
)

type Validator struct {
	dryRunStream *streams.Stream
}

func NewValidator() *Validator {
	return &Validator{}
}

func (v *Validator) Validate() error {
	stream, err := streams.NewStream()
	if err != nil {
		return err
	}
	v.dryRunStream = stream.WithStrictMode()

	log.Trace().Msg("Starting flows validation")
	if err := v.dryRunStream.Initialize(); err != nil {
		return err
	}

	if err := v.ValidateGatewayConfig(); err != nil {
		return err
	}

	log.Trace().Msg("Flows validation completed")
	return nil
}

func (v *Validator) ValidateGatewayConfig() error {
	log.Trace().Msg("Starting gateway config validation")
	configPath := environment.GetGatewayConfigPath()

	log.Trace().Msgf("Gateway config file path: %s", configPath)
	file, _ := os.Open(configPath)
	if file == nil {
		log.Trace().Msg("Gateway config file not found")
		return nil
	}
	defer file.Close()

	fileInfo, err := file.Stat()
	if err != nil {
		return err
	}

	// Check if the file is empty
	if fileInfo.Size() == 0 {
		return nil
	}

	var configData map[string]interface{}
	decoder := yaml.NewDecoder(file)
	if err := decoder.Decode(&configData); err != nil {
		return fmt.Errorf("failed to validate gateway config: %w", err)
	}

	return nil
}
