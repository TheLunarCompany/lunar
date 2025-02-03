package streamtypes

import (
	publictypes "lunar/engine/streams/public-types"
	"strconv"
)

type APIStream struct {
	name       string
	streamType publictypes.StreamType
	actionType publictypes.StreamType
	request    publictypes.TransactionI
	response   publictypes.TransactionI
	context    publictypes.LunarContextI
	resources  publictypes.ResourceManagementI
}

// NewAPIStream creates a new APIStream with the given name and StreamType
func NewAPIStream(name string, streamType publictypes.StreamType) publictypes.APIStreamI {
	return &APIStream{
		name:       name,
		streamType: streamType,
		actionType: streamType,
	}
}

func (s *APIStream) WithLunarContext(context publictypes.LunarContextI) publictypes.APIStreamI {
	s.context = context
	return s
}

func (s *APIStream) GetID() string {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetID()
	}
	return s.request.GetID()
}

func (s *APIStream) GetSequenceID() string {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetSequenceID()
	}
	return s.request.GetSequenceID()
}

func (s *APIStream) GetURL() string {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetURL()
	}
	return s.request.GetURL()
}

func (s *APIStream) GetHost() string {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetHost()
	}
	return s.request.GetHost()
}

func (s *APIStream) GetMethod() string {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetMethod()
	}
	return s.request.GetMethod()
}

func (s *APIStream) GetHeaders() map[string]string {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetHeaders()
	}
	return s.request.GetHeaders()
}

func (s *APIStream) GetStrStatus() string {
	if s.streamType.IsResponseType() && s.response != nil {
		return strconv.Itoa(s.response.GetStatus())
	}
	return ""
}

func (s *APIStream) GetSize() int {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.Size()
	}
	return s.request.Size()
}

func (s *APIStream) GetHeader(key string) (string, bool) {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetHeader(key)
	}
	return s.request.GetHeader(key)
}

func (s *APIStream) DoesHeaderValueMatch(headerName, headerValue string) bool {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.DoesHeaderValueMatch(headerName, headerValue)
	}
	return s.request.DoesHeaderValueMatch(headerName, headerValue)
}

func (s *APIStream) GetBody() string {
	if s.streamType.IsResponseType() && s.response != nil {
		return s.response.GetBody()
	}
	return s.request.GetBody()
}

func (s *APIStream) GetName() string {
	return s.name
}

func (s *APIStream) GetType() publictypes.StreamType {
	return s.streamType
}

func (s *APIStream) GetActionsType() publictypes.StreamType {
	return s.actionType
}

func (s *APIStream) GetRequest() publictypes.TransactionI {
	return s.request
}

func (s *APIStream) GetResponse() publictypes.TransactionI {
	return s.response
}

func (s *APIStream) GetResources() publictypes.ResourceManagementI {
	return s.resources
}

func (s *APIStream) GetContext() publictypes.LunarContextI {
	return s.context
}

func (s *APIStream) SetContext(context publictypes.LunarContextI) {
	s.context = context
}

func (s *APIStream) SetRequest(request publictypes.TransactionI) {
	s.actionType = publictypes.StreamTypeRequest
	s.streamType = publictypes.StreamTypeRequest
	s.request = request
}

func (s *APIStream) SetResponse(response publictypes.TransactionI) {
	s.actionType = publictypes.StreamTypeResponse
	s.streamType = publictypes.StreamTypeResponse
	s.response = response
}

func (s *APIStream) SetType(streamType publictypes.StreamType) {
	s.streamType = streamType
}

func (s *APIStream) SetActionsType(streamType publictypes.StreamType) {
	s.actionType = streamType
}
