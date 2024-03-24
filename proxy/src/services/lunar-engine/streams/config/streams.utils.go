package streamconfig

import (
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"
	"path/filepath"

	"github.com/rs/zerolog/log"
)

func GetFlows() ([]*FlowRepresentation, error) {
	var flows []*FlowRepresentation

	files, err := filepath.Glob(filepath.Join(environment.GetStreamsFlowsDirectory(), "*.yaml"))
	if err != nil {
		log.Warn().Err(err).Msg("failed to get flow files")
	}

	for _, file := range files {
		flow, readErr := ReadStreamFlowConfig(file)
		if readErr != nil {
			log.Warn().Err(readErr).Msg("failed to read flow")
			continue
		}
		if validateFlowRepresentation(flow) != nil {
			log.Warn().Err(err).Msgf("failed to validate flow yaml: %s", file)
			continue
		}
		flows = append(flows, flow)
	}
	return flows, nil
}

func ReadStreamFlowConfig(path string) (*FlowRepresentation, error) {
	config, readErr := configuration.DecodeYAML[FlowRepresentation](
		path,
	)
	if readErr != nil {
		return nil, readErr
	}

	return config, nil
}
