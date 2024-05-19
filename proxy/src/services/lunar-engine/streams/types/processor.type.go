package streamtypes

type Processor interface {
	GetName() string
	Execute(*APIStream) (ProcessorIO, error)
}

type ProcessorParam struct {
	Name  string
	Value interface{}
}

type ProcessorMetaData struct {
	Name                string
	ProcessorDefinition ProcessorDefinition
	Parameters          map[string]ProcessorParam
}

type ConfigurationParamTypes string

const (
	ConfigurationParamAny           ConfigurationParamTypes = "any"
	ConfigurationParamField         ConfigurationParamTypes = "field"
	ConfigurationParamString        ConfigurationParamTypes = "string"
	ConfigurationParamNumber        ConfigurationParamTypes = "number"
	ConfigurationParamBoolean       ConfigurationParamTypes = "boolean"
	ConfigurationParamListOfStrings ConfigurationParamTypes = "list_of_strings"
	ConfigurationParamListOfNumbers ConfigurationParamTypes = "list_of_numbers"
	ConfigurationParamEnum          ConfigurationParamTypes = "enum"
)
