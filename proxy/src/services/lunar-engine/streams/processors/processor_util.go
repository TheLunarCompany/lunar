package processors

import (
	"fmt"
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/streams/resources"
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"
	"lunar/toolkit-core/network"
	"os"
	"path/filepath"

	"github.com/rs/zerolog/log"
)

type ProcessorManager struct {
	procFactory        map[string]ProcessorFactory
	processors         map[string]*streamtypes.ProcessorDefinition
	processorInstances map[string]streamtypes.Processor
	resources          *resources.ResourceManagement
}

// NewProcessorManager creates a new processor manager
func NewProcessorManager(resources *resources.ResourceManagement) *ProcessorManager {
	return &ProcessorManager{
		processors:         make(map[string]*streamtypes.ProcessorDefinition),
		procFactory:        make(map[string]ProcessorFactory),
		processorInstances: make(map[string]streamtypes.Processor),
		resources:          resources,
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
		if !info.IsDir() && (ext == internaltypes.YAMLExtension ||
			ext == internaltypes.YMLExtension) {
			processor, readErr := readProcessorConfig(path)
			if readErr != nil {
				return fmt.Errorf("error reading processor config %s: %v", path, readErr)
			}
			if pm.isSupportedProcessor(processor) {
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

func (pm *ProcessorManager) GetProcessorInstance(
	processorKey string,
) (streamtypes.Processor, bool) {
	procDef, found := pm.processorInstances[processorKey]
	return procDef, found
}

// CreateProcessor creates a processor based on the processor configuration
func (pm *ProcessorManager) CreateProcessor(
	procConf publictypes.ProcessorDataI,
) (streamtypes.Processor, error) {
	log.Debug().Msgf("Creating processor %s", procConf.GetKey())
	// get proc definition
	procDef, exist := pm.processors[procConf.GetName()]
	if !exist {
		return nil, fmt.Errorf("processor %s not found", procConf.GetName())
	}
	// extract params
	params, err := pm.extractProcessorParameters(procConf, procDef)
	if err != nil {
		return nil, err
	}

	procMetadata := &streamtypes.ProcessorMetaData{
		Name:                procConf.GetKey(),
		Parameters:          params,
		ProcessorDefinition: *procDef,
		Resources:           pm.resources,
	}

	procInstance, found := pm.GetProcessorInstance(procConf.GetKey())
	if found {
		log.Trace().Msgf("Processor %s already exists", procConf.GetKey())
		return procInstance, nil
	}

	factory, found := pm.procFactory[procConf.GetName()]
	if !found {
		return nil, fmt.Errorf("processor factory %s not found", procConf.GetName())
	}
	log.Trace().Msgf("Creating processor %s with: %v", procConf.GetName(), procConf.ParamMap())
	procInstance, err = factory(procMetadata)
	if err != nil {
		return nil, fmt.Errorf("error creating processor %s: %v", procConf.GetName(), err)
	}
	pm.processorInstances[procConf.GetKey()] = procInstance
	return procInstance, nil
}

func (pm *ProcessorManager) GetLoadedConfig() []network.ConfigurationPayload {
	var loadedConfig []network.ConfigurationPayload
	for _, proc := range pm.processors {
		loadedConfig = append(loadedConfig, proc.Data)
	}

	if len(loadedConfig) == 0 {
		log.Debug().Msg("No processors loaded")
	}

	return loadedConfig
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

func (pm *ProcessorManager) isSupportedProcessor(procDef *streamtypes.ProcessorDefinition) bool {
	_, exists := pm.procFactory[procDef.Name]
	// TODO: Check if processor uses a resource and if it is available.
	// otherwise we should return an error here.
	return exists
}

// extractProcessorParameters extracts processor parameters from the processor configuration
func (pm *ProcessorManager) extractProcessorParameters(
	procConf publictypes.ProcessorDataI,
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
				log.Trace().Msgf("available params: %v", procParams)
				return nil, fmt.Errorf("param %s is required in processor %s", paramName, procConf.GetName())
			}
			defaultParam := publictypes.KeyValue{Key: paramName, Value: paramDef.Default}
			params[paramName] = streamtypes.ProcessorParam{
				Name:  paramName,
				Value: defaultParam.GetParamValue(),
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
	// Add YAML data to the processor definition
	config.UnmarshaledData.Data = network.ConfigurationPayload{
		Type:     "processor",
		FileName: path,
		Content:  config.Content,
	}
	return config.UnmarshaledData, nil
}
