package streamtypes

import (
	"lunar/engine/actions"
	publictypes "lunar/engine/streams/public-types"
	"lunar/toolkit-core/network"
)

type ProcessorDefinition struct {
	Name          string                              `yaml:"name"`
	Description   string                              `yaml:"description"`
	Exec          string                              `yaml:"exec"`
	Metrics       publictypes.ProcessorMetrics        `yaml:"metrics"`
	Parameters    map[string]ProcessorParamDefinition `yaml:"parameters"`
	OutputStreams []ProcessorIO                       `yaml:"output_streams"`
	InputStream   ProcessorIO                         `yaml:"input_stream"`
	Data          network.ConfigurationPayload
}

type ProcessorParamDefinition struct {
	Description string                              `yaml:"description"`
	Type        publictypes.ConfigurationParamTypes `yaml:"type"`
	Default     interface{}                         `yaml:"default"`
	Required    bool                                `yaml:"required"`
}

type ShortCircuit struct {
	ReqAction  actions.ReqLunarAction
	RespAction actions.RespLunarAction
}

type ProcessorIO struct {
	Name         string                 `yaml:"name"` // condition name
	Type         publictypes.StreamType `yaml:"type"`
	ReqAction    actions.ReqLunarAction
	RespAction   actions.RespLunarAction
	ShortCircuit *ShortCircuit
	Failure      bool // for case if we want measure failure without returning error
}
