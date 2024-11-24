package processors

import (
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/utils"
	"strings"
)

type mockAPIStream struct {
	url        string
	method     string
	body       string
	headers    map[string]string
	streamType publictypes.StreamType
	actionType publictypes.StreamType
	context    publictypes.LunarContextI
	request    publictypes.TransactionI
	response   publictypes.TransactionI
}

func (m *mockAPIStream) WithLunarContext(context publictypes.LunarContextI) publictypes.APIStreamI {
	m.context = context
	return m
}

func (m *mockAPIStream) SetActionsType(streamType publictypes.StreamType) {
	m.streamType = streamType
}

func (m *mockAPIStream) SetType(streamType publictypes.StreamType) {
	m.streamType = streamType
}

func (m *mockAPIStream) SetResponse(response publictypes.TransactionI) {
	m.response = response
}

func (m *mockAPIStream) GetURL() string {
	return m.url
}

func (m *mockAPIStream) GetMethod() string {
	return m.method
}

func (m *mockAPIStream) GetStrStatus() string {
	return ""
}

func (m *mockAPIStream) GetBody() string {
	return m.body
}

func (m *mockAPIStream) GetSize() int {
	return len(m.body)
}

func (m *mockAPIStream) GetHeader(key string) (string, bool) {
	value, found := utils.MakeHeadersLowercase(m.headers)[strings.ToLower(key)]
	if !found {
		return "", false
	}
	return value, true
}

func (m *mockAPIStream) GetHeaders() map[string]string {
	return m.headers
}

func (m *mockAPIStream) GetType() publictypes.StreamType {
	return m.streamType
}

func (m *mockAPIStream) DoesHeaderValueMatch(key, value string) bool {
	if existingHeaderValue, found := m.GetHeader(key); found {
		return strings.EqualFold(existingHeaderValue, value)
	}
	return false
}

func (m *mockAPIStream) GetContext() publictypes.LunarContextI {
	return m.context
}

func (m *mockAPIStream) SetContext(context publictypes.LunarContextI) {
	m.context = context
}

func (m *mockAPIStream) GetID() string {
	return ""
}

func (m *mockAPIStream) GetName() string {
	return "mockAPIStream"
}

func (m *mockAPIStream) GetRequest() publictypes.TransactionI {
	return m.request
}

func (m *mockAPIStream) SetRequest(request publictypes.TransactionI) {
	m.request = request
}

func (m *mockAPIStream) GetResponse() publictypes.TransactionI {
	return nil
}

func (m *mockAPIStream) GetActionsType() publictypes.StreamType {
	return m.actionType
}
