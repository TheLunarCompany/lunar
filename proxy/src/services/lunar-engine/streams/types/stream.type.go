package streamtypes

import (
	publictypes "lunar/engine/streams/public-types"
)

type APIStream struct {
	name       string
	streamType publictypes.StreamType
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
	}
}

func (s *APIStream) WithLunarContext(context publictypes.LunarContextI) publictypes.APIStreamI {
	s.context = context
	return s
}

func (s *APIStream) GetID() string {
	if s.streamType.IsResponseType() {
		return s.response.GetID()
	}
	return s.request.GetID()
}

func (s *APIStream) GetURL() string {
	if s.streamType.IsResponseType() {
		return s.response.GetURL()
	}
	return s.request.GetURL()
}

func (s *APIStream) GetMethod() string {
	if s.streamType.IsResponseType() {
		return s.response.GetMethod()
	}
	return s.request.GetMethod()
}

func (s *APIStream) GetHeaders() map[string]string {
	if s.streamType.IsResponseType() {
		return s.response.GetHeaders()
	}
	return s.request.GetHeaders()
}

func (s *APIStream) GetHeader(key string) (string, bool) {
	if s.streamType.IsResponseType() {
		return s.response.GetHeader(key)
	}
	return s.request.GetHeader(key)
}

func (s *APIStream) DoesHeaderValueMatch(headerName, headerValue string) bool {
	headers := s.GetHeaders()
	return DoesHeaderValueMatch(headers, headerName, headerValue)
}

func (s *APIStream) GetBody() string {
	if s.streamType.IsResponseType() {
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
	s.request = request
}

func (s *APIStream) SetResponse(response publictypes.TransactionI) {
	s.response = response
}

func (s *APIStream) SetType(streamType publictypes.StreamType) {
	s.streamType = streamType
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
