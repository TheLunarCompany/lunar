package processors

import (
	"fmt"
	"lunar/engine/utils/environment"
	"os"
	"path/filepath"
	"plugin"

	"github.com/rs/zerolog/log"

	"gopkg.in/yaml.v2"
)

const configFilename = "processors_config.yaml"

type UserProcessorConfig struct {
	Name    string `yaml:"name"`
	Module  string `yaml:"module"`
	Factory string `yaml:"factory"`
}

type UserConfig struct {
	Processors []UserProcessorConfig `yaml:"processors"`
}

func GetUserProcessors() (map[string]ProcessorFactory, error) {
	root := environment.GetUserProcessorsDirectory()
	if root == "" {
		log.Trace().Msg("user processors directory not set")
		return make(map[string]ProcessorFactory), nil
	}

	config, err := LoadUserProcessorsConfig(filepath.Join(root, configFilename))
	if err != nil {
		return nil, fmt.Errorf("error loading user processors config: %v", err)
	}

	processors, err := LoadUserProcessorsFromConfig(config)
	if err != nil {
		return nil, fmt.Errorf("error loading user processors from config: %v", err)
	}

	return processors, nil
}

// TODO: change input param this function receives after we decide
// how to handle the user processors config
func LoadUserProcessorsConfig(path string) (*UserConfig, error) {
	var config UserConfig
	data, _ := os.ReadFile(path)
	if len(data) == 0 {
		log.Trace().Msgf("user configuration file %s not available", path)
		return &config, nil
	}

	err := yaml.Unmarshal(data, &config)
	if err != nil {
		return nil, fmt.Errorf("error unmarshalling configuration file %s: %v", path, err)
	}

	return &config, nil
}

func LoadUserProcessorsFromConfig(config *UserConfig) (map[string]ProcessorFactory, error) {
	processors := make(map[string]ProcessorFactory)
	for _, proc := range config.Processors {
		p, err := plugin.Open(fmt.Sprintf("./%s.so", proc.Module))
		if err != nil {
			return nil, fmt.Errorf("failed to load plugin %s: %v", proc.Module, err)
		}

		sym, err := p.Lookup(proc.Factory)
		if err != nil {
			return nil, fmt.Errorf("cannot find factory %s in module %s: %v", proc.Factory, proc.Module, err)
		}

		factory, ok := sym.(ProcessorFactory)
		if !ok {
			return nil, fmt.Errorf("factory %s in module %s has wrong signature", proc.Factory, proc.Module)
		}
		processors[proc.Name] = factory
	}
	return processors, nil
}
