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
	dryRunStream  *streams.Stream
	validationDir string
}

func NewValidator() *Validator {
	return &Validator{}
}

func (v *Validator) WithValidationDir(dir string) *Validator {
	v.validationDir = dir
	return v
}

func (v *Validator) Validate() (err error) {
	v.dryRunStream, err = streams.NewValidationStream(v.validationDir)
	if err != nil {
		return err
	}
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
	var configPath string
	if v.validationDir != "" {
		configPath = environment.GetCustomGatewayConfigPath(v.validationDir)
	}

	if configPath == "" {
		configPath = environment.GetGatewayConfigPath()
	}

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
