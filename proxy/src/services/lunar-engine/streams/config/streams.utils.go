package streamconfig

import (
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"
	"path/filepath"

	"github.com/rs/zerolog/log"
)

func (c *Connection) IsValid() bool {
	return c.Stream != nil || c.Flow != nil || c.Processor != nil
}

func (f Filter) IsAnyURLAccepted() bool {
	return f.URL == "" || f.URL == "*" || f.URL == ".*"
}

func (f *Flow) GetFlowConnections(streamType streamtypes.StreamType) []*FlowConnection {
	switch streamType {
	case streamtypes.StreamTypeRequest:
		return f.Request
	case streamtypes.StreamTypeResponse:
		return f.Response
		// handle StreamTypeAny case
	case streamtypes.StreamTypeAny:
		// handle StreamTypeMirror case
	case streamtypes.StreamTypeMirror:
	}
	return nil
}

func (p *Processor) ParamMap() map[string]string {
	params := make(map[string]string)
	for _, param := range p.Parameters {
		params[param.Key] = param.Value
	}
	return params
}

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
