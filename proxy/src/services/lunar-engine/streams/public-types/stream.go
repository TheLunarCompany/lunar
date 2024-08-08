package publictypes

import (
	"fmt"

	"github.com/rs/zerolog/log"
)

type KeyValue struct {
	Key   string      `yaml:"key"`
	Value interface{} `yaml:"value"`
}

type ParamValue struct {
	valueType        ConfigurationParamTypes
	valueString      string
	valueInt         int
	valueMapOfString map[string]string
	valueMapOfInt    map[string]int
}

func NewKeyValue(key string, value interface{}) *KeyValue {
	keyValue := &KeyValue{
		Key:   key,
		Value: value,
	}

	return keyValue
}

func (kv *KeyValue) GetParamValue() *ParamValue {
	param := &ParamValue{}
	switch val := kv.Value.(type) {
	case string:
		param.valueType = ConfigurationParamString
		param.valueString = val
	case int:
		param.valueType = ConfigurationParamNumber
		param.valueInt = val
	case map[string]interface{}:
		if isMapOf[int](val) {
			param.valueType = ConfigurationParamMapOfNumbers
			param.valueMapOfInt = make(map[string]int)
			for k, v := range val {
				param.valueMapOfInt[k] = v.(int)
			}
		} else if isMapOf[string](val) {
			param.valueType = ConfigurationParamMapOfStrings
			param.valueMapOfString = make(map[string]string)
			for k, v := range val {
				param.valueMapOfString[k] = v.(string)
			}
		}
	default:
		log.Debug().Msgf("Unsupported type: %T", kv.Value)
	}
	return param
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

type StreamType int

const (
	GlobalStream = "globalStream"
	StreamStart  = "start"
	StreamEnd    = "end"

	StreamTypeMirror StreamType = iota
	StreamTypeResponse
	StreamTypeRequest
	StreamTypeAny
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
