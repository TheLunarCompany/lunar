package publictypes

type ProcessorDataI interface {
	ParamMap() map[string]*ParamValue
	GetName() string
}

type ConfigurationParamTypes string

const (
	ConfigurationParamAny           ConfigurationParamTypes = "any"
	ConfigurationParamField         ConfigurationParamTypes = "field"
	ConfigurationParamString        ConfigurationParamTypes = "string"
	ConfigurationParamNumber        ConfigurationParamTypes = "number"
	ConfigurationParamBoolean       ConfigurationParamTypes = "boolean"
	ConfigurationParamListOfStrings ConfigurationParamTypes = "list_of_strings"
	ConfigurationParamMapOfStrings  ConfigurationParamTypes = "map_of_strings"
	ConfigurationParamMapOfNumbers  ConfigurationParamTypes = "map_of_numbers"
	ConfigurationParamListOfNumbers ConfigurationParamTypes = "list_of_numbers"
	ConfigurationParamEnum          ConfigurationParamTypes = "enum"
)
