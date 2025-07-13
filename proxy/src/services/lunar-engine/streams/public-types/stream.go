package publictypes

import (
	"fmt"

	"github.com/rs/zerolog/log"
)

// customParamValueUnmarshalHooks is a map of custom unmarshal hooks for specific parameter keys.
var customParamValueUnmarshalHooks = map[string]func(any) (*ParamValue, error){
	"status_code":      statusCodeParamUnmarshalHook,
	"headers":          kvOpParamUnmarshalHook,
	"response_headers": kvOpParamUnmarshalHook,
	"query_params":     kvOpParamUnmarshalHook,
	"path_params":      kvOpParamUnmarshalHook,
}

type KeyValue struct {
	Key   string `yaml:"key"`
	Value any    `yaml:"value"`
}
type ParamValue struct {
	valueType            ConfigurationParamTypes
	valueString          string
	valueBool            bool
	valueInt             int
	valueFloat64         float64
	valueMapOfString     map[string]string
	valueMapOfInt        map[string]int
	valueMapOfAny        map[string]any
	valueListOfInt       []int
	valueListOfFloat     []float64
	valueListOfStr       []string
	valueKVOpParam       *KVOpParam
	valueStatusCodeParam *StatusCodeParam
}

func NewParamValue(value any) *ParamValue {
	paramValue := &ParamValue{}
	switch val := value.(type) {
	case string:
		paramValue.valueType = ConfigurationParamString
		paramValue.valueString = val
	case int:
		paramValue.valueType = ConfigurationParamNumber
		paramValue.valueInt = val
	case float64:
		paramValue.valueType = ConfigurationParamNumber
		paramValue.valueFloat64 = val
	case bool:
		paramValue.valueType = ConfigurationParamBoolean
		paramValue.valueBool = val
	case map[string]any:
		if isMapOf[int](val) {
			paramValue.valueType = ConfigurationParamMapOfNumbers
			paramValue.valueMapOfInt = make(map[string]int)
			for k, v := range val {
				paramValue.valueMapOfInt[k] = v.(int)
			}
		} else if isMapOf[string](val) {
			paramValue.valueType = ConfigurationParamMapOfStrings
			paramValue.valueMapOfString = make(map[string]string)
			for k, v := range val {
				paramValue.valueMapOfString[k] = v.(string)
			}
		} else if isMapOf[any](val) {
			paramValue.valueType = ConfigurationParamMapOfAny
			paramValue.valueMapOfAny = make(map[string]any)
			for k, v := range val {
				paramValue.valueMapOfAny[k] = v
			}
		}
	case map[string]string:
		paramValue.valueType = ConfigurationParamMapOfStrings
		paramValue.valueMapOfString = make(map[string]string)
		for k, v := range val {
			paramValue.valueMapOfString[k] = v
		}
	case []int:
		paramValue.valueType = ConfigurationParamListOfNumbers
		paramValue.valueListOfInt = []int{}
		paramValue.valueListOfInt = append(paramValue.valueListOfInt, val...)
	case []float64:
		paramValue.valueType = ConfigurationParamListOfNumbers
		paramValue.valueListOfFloat = []float64{}
		paramValue.valueListOfFloat = append(paramValue.valueListOfFloat, val...)
	case []string:
		paramValue.valueType = ConfigurationParamListOfStrings
		paramValue.valueListOfStr = []string{}
		paramValue.valueListOfStr = append(paramValue.valueListOfStr, val...)
	case []any:
		isListOfInt := isListOf[int](val)
		if isListOfInt {
			paramValue.valueType = ConfigurationParamListOfNumbers
			paramValue.valueListOfInt = []int{}
			for _, v := range val {
				paramValue.valueListOfInt = append(paramValue.valueListOfInt, v.(int))
			}
		}
		// If we have a list of integers we can support a list of floats as well
		if isListOfInt || isListOf[float64](val) {
			paramValue.valueListOfFloat = []float64{}
			for _, v := range paramValue.valueListOfInt {
				paramValue.valueListOfFloat = append(paramValue.valueListOfFloat, float64(v))
			}
		}
		if isListOf[string](val) {
			paramValue.valueType = ConfigurationParamListOfStrings
			paramValue.valueListOfStr = []string{}
			for _, v := range val {
				paramValue.valueListOfStr = append(paramValue.valueListOfStr, v.(string))
			}
		}
	}
	return paramValue
}

func NewKeyValue(key string, value interface{}) *KeyValue {
	keyValue := &KeyValue{
		Key:   key,
		Value: value,
	}
	return keyValue
}

func (kv *KeyValue) GetParamValue() *ParamValue {
	if customUnmarshal, ok := customParamValueUnmarshalHooks[kv.Key]; ok {
		paramValue, err := customUnmarshal(kv.Value)
		if err != nil {
			log.Trace().Err(err).Msgf("Failed to custom unmarshal parameter '%s, using default", kv.Key)
			// Fallback to default unmarshalling if custom hook fails -
			// in order to avoid breaking changes for legacy headers. Will be removed in the future.
			return NewParamValue(kv.Value)
		}
		return paramValue
	}
	return NewParamValue(kv.Value)
}

// UnmarshalYAML implements custom unmarshalling for KeyValue
func (kv *KeyValue) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var aux struct {
		Key   string
		Value interface{}
	}

	log.Trace().Msg("Unmarshalling KeyValue")
	if err := unmarshal(&aux); err != nil {
		return err
	}

	kv.Key = aux.Key
	kv.Value = aux.Value
	return nil
}

func (v *ParamValue) GetString() string {
	if v.valueType != ConfigurationParamString {
		log.Debug().Str("type", string(v.valueType)).
			Msg("Value is not a string")
		return ""
	}
	return v.valueString
}

func (v *ParamValue) GetInt() int {
	if v.valueType != ConfigurationParamNumber {
		log.Debug().Str("type", string(v.valueType)).
			Msg("Value is not a number")
		return 0
	}
	return v.valueInt
}

func (v *ParamValue) GetFloat64() float64 {
	if v.valueType != ConfigurationParamNumber {
		log.Debug().Str("type", string(v.valueType)).
			Msg("Value is not a number")
		return 0
	}
	return v.valueFloat64
}

func (v *ParamValue) GetBool() bool {
	if v.valueType != ConfigurationParamBoolean {
		log.Debug().Str("type", string(v.valueType)).
			Msg("Value is not a boolean")
		return false
	}
	return v.valueBool
}

func (v *ParamValue) GetMapOfString() map[string]string {
	if v.valueType != ConfigurationParamMapOfStrings {
		log.Debug().Str("type", string(v.valueType)).
			Msg("Value is not a map of strings")
		return nil
	}
	return v.valueMapOfString
}

func (v *ParamValue) GetMapOfInt() map[string]int {
	if v.valueType != ConfigurationParamMapOfNumbers {
		log.Debug().Str("type", string(v.valueType)).
			Msg("Value is not a map of numbers")
		return nil
	}
	return v.valueMapOfInt
}

func (v *ParamValue) GetMapOfAny() map[string]any {
	if v.valueType == ConfigurationParamMapOfStrings {
		log.Trace().Str("type", string(v.valueType)).
			Msg("Value is not a map of any, converting to map of any")
		valueMapOfAny := make(map[string]any)
		for k, v := range v.valueMapOfString {
			valueMapOfAny[k] = v
		}
		return valueMapOfAny
	}
	if v.valueType == ConfigurationParamMapOfNumbers {
		log.Trace().Str("type", string(v.valueType)).
			Msg("Value is not a map of any, converting to map of any")
		valueMapOfAny := make(map[string]any)
		for k, v := range v.valueMapOfInt {
			valueMapOfAny[k] = v
		}
		return valueMapOfAny
	}

	if v.valueType != ConfigurationParamMapOfAny {
		log.Debug().Str("type", string(v.valueType)).
			Msg("Value is not a map of any")
		return nil
	}
	return v.valueMapOfAny
}

func (v *ParamValue) GetListOfString() []string {
	if v.valueType != ConfigurationParamListOfStrings {
		log.Debug().Str("type", string(v.valueType)).
			Msg("Value is not a list of strings")
		return nil
	}
	return v.valueListOfStr
}

func (v *ParamValue) GetStatusCodeParam() *StatusCodeParam {
	return v.valueStatusCodeParam
}

func (v *ParamValue) GetKVOpParam() *KVOpParam {
	return v.valueKVOpParam
}

func (v *ParamValue) GetListOfInt() []int {
	if v.valueType != ConfigurationParamListOfNumbers {
		log.Debug().Str("type", string(v.valueType)).
			Msg("Value is not a list of integers")
		return nil
	}
	return v.valueListOfInt
}

func (v *ParamValue) GetListOfFloat64() []float64 {
	if v.valueType != ConfigurationParamListOfNumbers {
		return nil
	}
	return v.valueListOfFloat
}

type StreamType int

const (
	GlobalStream = "globalStream"
	StreamStart  = "start"
	StreamEnd    = "end"
)

const (
	StreamTypeAny StreamType = iota
	StreamTypeResponse
	StreamTypeRequest
	StreamTypeMirror
)

var streamTypeToString = map[StreamType]string{
	StreamTypeMirror:   "StreamTypeMirror",
	StreamTypeResponse: "StreamTypeResponse",
	StreamTypeRequest:  "StreamTypeRequest",
	StreamTypeAny:      "StreamTypeAny",
}

var stringToStreamType = map[string]StreamType{
	"StreamTypeMirror":   StreamTypeMirror,
	"StreamTypeResponse": StreamTypeResponse,
	"StreamTypeRequest":  StreamTypeRequest,
	"StreamTypeAny":      StreamTypeAny,
}

func (s StreamType) String() string {
	if str, ok := streamTypeToString[s]; ok {
		return str
	}
	return fmt.Sprintf("StreamType(%d)", s)
}

func (s *StreamType) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var str string
	if err := unmarshal(&str); err != nil {
		return err
	}
	if streamType, ok := stringToStreamType[str]; ok {
		*s = streamType
		return nil
	}
	return fmt.Errorf("invalid StreamType: %s", str)
}

func (s StreamType) IsRequestType() bool {
	return s == StreamTypeRequest
}

func (s StreamType) IsAnyType() bool {
	return s == StreamTypeAny
}

func (s StreamType) IsResponseType() bool {
	return s == StreamTypeResponse
}

func isMapOf[T any](m map[string]interface{}) bool {
	for _, v := range m {
		_, ok := v.(T)
		if !ok {
			return false
		}
	}
	return true
}

func isListOf[T any](l []interface{}) bool {
	for _, v := range l {
		_, ok := v.(T)
		if !ok {
			return false
		}
	}
	return true
}
