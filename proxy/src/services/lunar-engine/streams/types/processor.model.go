package streamtypes

type ProcessorDefinition struct {
	Name          string                              `yaml:"name"`
	Description   string                              `yaml:"description"`
	Exec          string                              `yaml:"exec"`
	Parameters    map[string]ProcessorParamDefinition `yaml:"parameters"`
	OutputStreams []ProcessorIO                       `yaml:"output_streams"`
	InputStream   ProcessorIO                         `yaml:"input_stream"`
}

type ProcessorParamDefinition struct {
	Description string                  `yaml:"description"`
	Type        ConfigurationParamTypes `yaml:"type"`
	Default     interface{}             `yaml:"default"`
	Required    bool                    `yaml:"required"`
}

type ProcessorIO struct {
	Name string     `yaml:"name"`
	Type StreamType `yaml:"type"`
}
