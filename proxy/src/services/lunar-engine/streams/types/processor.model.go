package streamtypes

import (
	"lunar/engine/actions"
	publictypes "lunar/engine/streams/public-types"
)

type ProcessorDefinition struct {
	Name          string                              `yaml:"name"`
	Description   string                              `yaml:"description"`
	Exec          string                              `yaml:"exec"`
	Parameters    map[string]ProcessorParamDefinition `yaml:"parameters"`
	OutputStreams []ProcessorIO                       `yaml:"output_streams"`
	InputStream   ProcessorIO                         `yaml:"input_stream"`
}

type ProcessorParamDefinition struct {
	Description string                              `yaml:"description"`
	Type        publictypes.ConfigurationParamTypes `yaml:"type"`
	Default     interface{}                         `yaml:"default"`
	Required    bool                                `yaml:"required"`
}

type ProcessorIO struct {
	Name       string                 `yaml:"name"` // condition name
	Type       publictypes.StreamType `yaml:"type"`
	ReqAction  actions.ReqLunarAction
	RespAction actions.RespLunarAction
}
