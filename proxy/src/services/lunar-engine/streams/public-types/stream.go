package publictypes

import (
	"fmt"
	"strconv"
)

type KeyValue struct {
	Key   string `yaml:"key"`
	Value string `yaml:"value"`
}

// UnmarshalYAML implements custom unmarshalling for KeyValue
func (kv *KeyValue) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var aux struct {
		Key   string      `yaml:"key"`
		Value interface{} `yaml:"value"`
	}

	if err := unmarshal(&aux); err != nil {
		return err
	}

	kv.Key = aux.Key
	switch val := aux.Value.(type) {
	case string:
		kv.Value = val
	case int:
		kv.Value = strconv.Itoa(val)
	case float64:
		kv.Value = fmt.Sprintf("%v", val)
	default:
		return fmt.Errorf("unexpected type %T for value", val)
	}

	return nil
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
