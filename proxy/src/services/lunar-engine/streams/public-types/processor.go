package publictypes

type ProcessorDataI interface {
	ParamMap() map[string]*ParamValue
	ProcessorMetrics() *ProcessorMetrics
	ParamList() []*KeyValue
	AddParam(*KeyValue)
	UpdateParam(int, *KeyValue) error
	GetName() string
	GetKey() string
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
	ConfigurationParamMapOfAny      ConfigurationParamTypes = "map_of_any"
	ConfigurationParamListOfNumbers ConfigurationParamTypes = "list_of_numbers"
	ConfigurationParamListOfKVOps   ConfigurationParamTypes = "list_of_kv_ops"
	ConfigurationParamEnum          ConfigurationParamTypes = "enum"
)

type ProcessorMetrics struct {
	Enabled bool     `yaml:"enabled"`
	Labels  []string `yaml:"labels"`
}
