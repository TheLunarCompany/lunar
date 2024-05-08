package streamtypes

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

func (t StreamType) IsRequestType() bool {
	return t == StreamTypeRequest
}

func (t StreamType) IsResponseType() bool {
	return t == StreamTypeResponse
}
