package streamtypes

import "fmt"

type APIStream struct {
	Name     string
	Type     StreamType
	Request  *OnRequest
	Response *OnResponse
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

func (s StreamType) IsResponseType() bool {
	return s == StreamTypeResponse
}
