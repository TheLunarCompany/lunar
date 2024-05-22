package processors

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"
	"os"
	"path/filepath"

	"github.com/rs/zerolog/log"
)

type ProcessorManager struct {
	procFactory map[string]ProcessorFactory
	processors  map[string]*streamtypes.ProcessorDefinition
}

// NewProcessorManager creates a new processor manager
func NewProcessorManager() *ProcessorManager {
	return &ProcessorManager{
		processors:  make(map[string]*streamtypes.ProcessorDefinition),
		procFactory: make(map[string]ProcessorFactory),
	}
}

// Init loads all processors from the processors directory
func (pm *ProcessorManager) Init() error {
	log.Info().Msg("Loading processors")

	root := environment.GetProcessorsDirectory()
	if root == "" {
		return fmt.Errorf("processors directory not set")
	}

	if err := pm.initFactories(); err != nil {
		return fmt.Errorf("error initializing processor factories: %v", err)
	}

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Check if the file has .yaml or .yml extension
		ext := filepath.Ext(info.Name())
		if !info.IsDir() && (ext == ".yaml" || ext == ".yml") {
			processor, readErr := readProcessorConfig(path)
			if readErr != nil {
				return fmt.Errorf("error reading processor config %s: %v", path, readErr)
			}
			if pm.isSupportedProcessor(processor.Name) {
				log.Trace().Msgf("Loaded processor %s", processor.Name)
				pm.processors[processor.Name] = processor
			}
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("error loading processors: %v", err)
	}

	log.Debug().Msgf("Loaded %d processors", len(pm.processors))
	return nil
}

// CreateProcessor creates a processor based on the processor configuration
func (pm *ProcessorManager) CreateProcessor(
	procConf streamconfig.Processor,
) (streamtypes.Processor, error) {
	log.Debug().Msgf("Creating processor %s", procConf.Processor)
	// get proc definition
	procDef, exist := pm.processors[procConf.Processor]
	if !exist {
		return nil, fmt.Errorf("processor %s not found", procConf.Processor)
	}
	// extract params
	params, err := pm.extractProcessorParameters(procConf, procDef)
	if err != nil {
		return nil, err
	}

	procMetadata := &streamtypes.ProcessorMetaData{
		Name:                procDef.Name,
		Parameters:          params,
		ProcessorDefinition: *procDef,
	}

	factory, found := pm.procFactory[procConf.Processor]
	if !found {
		return nil, fmt.Errorf("processor factory %s not found", procConf.Processor)
	}

	return factory(procMetadata)
}

// SetFactory sets a processor factory
func (pm *ProcessorManager) SetFactory(name string, factory ProcessorFactory) {
	pm.procFactory[name] = factory
}

func (pm *ProcessorManager) initFactories() error {
	for name, factory := range internalProcessorRegistry {
		pm.procFactory[name] = factory
	}

	userProcFactories, err := GetUserProcessors()
	if err != nil {
		return fmt.Errorf("error loading user processors: %v", err)
	}
	for name, factory := range userProcFactories {
		if _, found := pm.procFactory[name]; found {
			return fmt.Errorf("processor factory %s already exists", name)
		}
		pm.procFactory[name] = factory
	}
	return nil
}

func (pm *ProcessorManager) isSupportedProcessor(name string) bool {
	_, exists := pm.procFactory[name]
	return exists
}

// extractProcessorParameters extracts processor parameters from the processor configuration
func (pm *ProcessorManager) extractProcessorParameters(
	procConf streamconfig.Processor,
	procDef *streamtypes.ProcessorDefinition,
) (map[string]streamtypes.ProcessorParam, error) {
	params := make(map[string]streamtypes.ProcessorParam)

	procParams := procConf.ParamMap()
	for paramName, paramDef := range procDef.Parameters {
		paramValue, exist := procParams[paramName]
		if exist {
			params[paramName] = streamtypes.ProcessorParam{
				Name:  paramName,
				Value: paramValue,
			}
		} else {
			if paramDef.Required {
				return nil, fmt.Errorf("param %s is required in processor %s", paramName, procConf.Processor)
			}
			if utils.IsInterfaceNil(paramDef.Default) {
				return nil, fmt.Errorf("param %s has no default in processor %s", paramName, procConf.Processor)
			}
			params[paramName] = streamtypes.ProcessorParam{
				Name:  paramName,
				Value: paramDef.Default,
			}
		}
	}
	return params, nil
}

// readProcessorConfig reads a processor configuration from a file
func readProcessorConfig(path string) (*streamtypes.ProcessorDefinition, error) {
	config, readErr := configuration.DecodeYAML[streamtypes.ProcessorDefinition](path)
	if readErr != nil {
		return nil, readErr
	}

	return config, nil
}
