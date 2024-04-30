package streamtypes

type APIStream struct {
	Name     string
	Type     StreamType
	Request  *OnRequest
	Response *OnResponse
}

type StreamType int

const (
	StreamTypeMirror StreamType = iota
	StreamTypeResponse
	StreamTypeRequest
	StreamTypeAny
)
