package streamtypes

import "fmt"

type APIStream struct {
	Name     string
	Type     StreamType
	Request  *OnRequest
	Response *OnResponse
	Context  LunarContextI
}

// NewAPIStream creates a new APIStream with the given name and StreamType
func NewAPIStream(name string, streamType StreamType) *APIStream {
	return &APIStream{
		Name: name,
		Type: streamType,
	}
}

func (s *APIStream) WithLunarContext(context LunarContextI) *APIStream {
	s.Context = context
	return s
}

func (s *APIStream) GetURL() string {
	if s.Type.IsResponseType() {
		return s.Response.URL
	}
	return s.Request.URL
}

func (s *APIStream) GetMethod() string {
	if s.Type.IsResponseType() {
		return s.Response.Method
	}
	return s.Request.Method
}

func (s *APIStream) GetHeaders() map[string]string {
	if s.Type.IsResponseType() {
		return s.Response.Headers
	}
	return s.Request.Headers
}

func (s *APIStream) GetBody() string {
	if s.Type.IsResponseType() {
		return s.Response.Body
	}
	return s.Request.Body
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

func DoesHeaderExist(headers map[string]string, headerName string) bool {
	_, found := headers[headerName]
	return found
}

func DoesHeaderValueMatch(headers map[string]string, headerName, headerValue string) bool {
	if !DoesHeaderExist(headers, headerName) {
		return false
	}
	return headers[headerName] == headerValue
}
