package pathparamsresource

import (
	"fmt"
	"io/fs"
	internaltypes "lunar/engine/streams/internal-types"
	"lunar/engine/utils/environment"
	sharedDiscovery "lunar/shared-model/discovery"
	"lunar/toolkit-core/configuration"
	"lunar/toolkit-core/network"
	"lunar/toolkit-core/urltree"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
	"gopkg.in/yaml.v2"
)

const (
	pathParamConfigEnvVar = "LUNAR_FLOWS_PATH_PARAM_CONFIG"
)

type (
	EmptyStruct = struct{}
)

type PathParams struct {
	duplicationValidation *urltree.URLTree[struct{}]
	loadedConfig          []network.ConfigurationPayload
	pathParams            *PathParamsRaw
}

func NewPathParams() *PathParams {
	pathParams := &PathParams{
		duplicationValidation: urltree.NewURLTree[EmptyStruct](false, 0),
		loadedConfig:          []network.ConfigurationPayload{},
		pathParams:            &PathParamsRaw{},
	}
	if err := pathParams.init(); err != nil {
		log.Warn().Err(err).Msg("Failed to initialize path params")
	}

	return pathParams
}

func (pp *PathParams) WithData(pathParams []*PathParam) error {
	return pp.storePathParams(pathParams)
}

func (pp *PathParams) GetPathParams() []*PathParam {
	return pp.pathParams.PathParams
}

func (pp *PathParams) SetPathParams(URL string) error {
	err := pp.addURLToTree(URL)
	if err != nil {
		return err
	}

	pp.pathParams.PathParams = append(pp.pathParams.PathParams, &PathParam{
		URL: URL,
	})
	return nil
}

func (pp *PathParams) GeneratePathParamConfFile() error {
	return pp.writePathParams()
}

func (pp *PathParams) init() error {
	return pp.loadAndParsePathParamsFiles()
}

func (pp *PathParams) loadAndParsePathParamsFiles() error {
	pathParamsPath := environment.GetPathParamsDirectory()
	paramsResourceFiles, err := findPathParamsResources(pathParamsPath)
	if err != nil {
		return err
	}

	for _, path := range paramsResourceFiles {
		config, readErr := configuration.DecodeYAML[PathParamsRaw](path)
		if readErr != nil {
			return readErr
		}

		pp.loadedConfig = append(pp.loadedConfig, network.ConfigurationPayload{
			Type:     "path-params-resource",
			FileName: path,
			Content:  config.Content,
		})

		err := pp.storePathParams(config.UnmarshaledData.PathParams)
		if err != nil {
			return err
		}

	}
	return nil
}

func (pp *PathParams) storePathParams(pathParams []*PathParam) error {
	for _, pathParam := range pathParams {
		err := pp.addURLToTree(pathParam.URL)
		if err != nil {
			return err
		}

		pp.pathParams.PathParams = append(pp.pathParams.PathParams, pathParam)
	}
	return nil
}

func (pp *PathParams) addURLToTree(URL string) error {
	emptyStruct := EmptyStruct{}
	err := pp.duplicationValidation.Insert(URL, &emptyStruct)
	if err != nil {
		return fmt.Errorf("error inserting URL into duplication validation tree: %v", err)
	}
	return nil
}

func (pp *PathParams) writePathParams() error {
	policies := sharedDiscovery.KnownEndpoints{}
	for _, pathParam := range pp.pathParams.PathParams {
		policies.Endpoints = append(policies.Endpoints, sharedDiscovery.Endpoint{
			URL: pathParam.URL,
		})
	}

	policiesPath, err := GetPathParamConfigPath()
	if err != nil {
		return err
	}

	return createYAMLFile(policies, policiesPath)
}

func findPathParamsResources(dir string) ([]string, error) {
	var files []string
	err := filepath.WalkDir(dir, func(path string, directory fs.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}

		if !directory.IsDir() && strings.HasSuffix(path, internaltypes.YAMLExtension) {
			files = append(files, path)
		}
		return nil
	})
	return files, err
}

func GetPathParamConfigPath() (string, error) {
	path, pathErr := configuration.GetPathFromEnvVarOrDefault(
		pathParamConfigEnvVar,
		// Maybe we need to change the default value
		// (using this one as this is what is used in the aggregation-output-plugin)
		"./policies.yaml",
	)
	if pathErr != nil {
		return "", pathErr
	}
	return path, nil
}

func createYAMLFile(data interface{}, filePath string) error {
	yamlData, err := yaml.Marshal(data)
	if err != nil {
		return fmt.Errorf("error marshalling data to YAML: %v", err)
	}

	err = os.WriteFile(filePath, yamlData, 0o644)
	if err != nil {
		return fmt.Errorf("error writing YAML file: %v", err)
	}

	fmt.Printf("YAML file '%s' created successfully.\n", filePath)
	return nil
}
