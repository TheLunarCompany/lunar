package testutils

import (
	"encoding/json"
	"net/url"
	"time"

	public_types "lunar/engine/streams/public-types"
)

type mockAPIStream struct {
	streamType public_types.StreamType
	request    public_types.TransactionI
	response   public_types.TransactionI
}

func NewMockAPIStream(
	rawURL string,
	reqHeaders, respHeaders map[string]string,
	reqBody, respBody string,
) public_types.APIStreamI {
	return &mockAPIStream{
		streamType: public_types.StreamTypeRequest,
		request:    newMockTransaction(rawURL, reqHeaders, reqBody, public_types.StreamTypeRequest),
		response:   newMockTransaction(rawURL, respHeaders, respBody, public_types.StreamTypeResponse),
	}
}

func (m *mockAPIStream) GetRequest() public_types.TransactionI  { return m.request }
func (m *mockAPIStream) GetResponse() public_types.TransactionI { return m.response }

func (m *mockAPIStream) DiscardRequest()       {}
func (m *mockAPIStream) StoreRequest()         {}
func (m *mockAPIStream) GetID() string         { return "stream-id" }
func (m *mockAPIStream) GetSequenceID() string { return "seq-id" }
func (m *mockAPIStream) GetType() public_types.StreamType {
	return m.streamType
}
func (m *mockAPIStream) GetActionsType() public_types.StreamType { return 0 }
func (m *mockAPIStream) GetName() string                         { return "mock-stream" }
func (m *mockAPIStream) GetHeaders() map[string]string {
	if m.GetType() == public_types.StreamTypeRequest {
		return m.request.GetHeaders()
	}
	return m.response.GetHeaders()
}

func (m *mockAPIStream) GetURL() string {
	return m.request.GetURL()
}

func (m *mockAPIStream) GetHost() string {
	return m.request.GetHost()
}
func (m *mockAPIStream) GetBody() string                          { return "" }
func (m *mockAPIStream) GetStrStatus() string                     { return "200" }
func (m *mockAPIStream) GetMethod() string                        { return "GET" }
func (m *mockAPIStream) GetSize() int                             { return 1234 }
func (m *mockAPIStream) GetHeader(string) (string, bool)          { return "", false }
func (m *mockAPIStream) DoesHeaderValueMatch(string, string) bool { return false }
func (m *mockAPIStream) GetContext() public_types.LunarContextI   { return nil }
func (m *mockAPIStream) SetRequest(public_types.TransactionI)     {}
func (m *mockAPIStream) SetResponse(public_types.TransactionI)    {}
func (m *mockAPIStream) SetContext(public_types.LunarContextI) {
}

func (m *mockAPIStream) SetType(actionType public_types.StreamType) {
	m.streamType = actionType
}

func (m *mockAPIStream) SetActionsType(public_types.StreamType) {}

func (m *mockAPIStream) WithLunarContext(public_types.LunarContextI) public_types.APIStreamI {
	return m
}

// Fully implemented mock for TransactionI
type mockTransaction struct {
	reqType   public_types.StreamType
	parsedURL *url.URL

	URL     string
	Headers map[string]string
	Body    string
}

func newMockTransaction(
	rawURL string,
	headers map[string]string,
	body string,
	reqType public_types.StreamType,
) *mockTransaction {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return nil
	}
	parsedURL.ForceQuery = true
	return &mockTransaction{
		reqType:   reqType,
		parsedURL: parsedURL,
		URL:       rawURL,
		Headers:   headers,
		Body:      body,
	}
}

func (m *mockTransaction) IsNewSequence() bool                          { return false }
func (m *mockTransaction) DoesHeaderExist(string) bool                  { return false }
func (m *mockTransaction) DoesHeaderValueMatch(string, string) bool     { return false }
func (m *mockTransaction) DoesQueryParamExist(string) bool              { return false }
func (m *mockTransaction) DoesQueryParamValueMatch(string, string) bool { return false }
func (m *mockTransaction) GetSize() int                                 { return 1024 }
func (m *mockTransaction) GetID() string                                { return "txn-id" }
func (m *mockTransaction) GetSequenceID() string                        { return "seq-id" }
func (m *mockTransaction) GetMethod() string                            { return "POST" }
func (m *mockTransaction) GetURL() string                               { return m.URL }

func (m *mockTransaction) GetParsedURL() *url.URL {
	u, _ := url.Parse(m.GetURL())
	return u
}
func (m *mockTransaction) GetScheme() string               { return m.parsedURL.Scheme }
func (m *mockTransaction) GetPath() string                 { return m.parsedURL.Path }
func (m *mockTransaction) GetQuery() string                { return m.parsedURL.RawQuery }
func (m *mockTransaction) GetHost() string                 { return m.parsedURL.Host }
func (m *mockTransaction) GetStatus() int                  { return 200 }
func (m *mockTransaction) GetHeader(string) (string, bool) { return "", false }
func (m *mockTransaction) GetHeaders() map[string]string   { return m.Headers }
func (m *mockTransaction) GetBody() string                 { return m.Body }
func (m *mockTransaction) GetTime() time.Time              { return time.Now() }
func (m *mockTransaction) ToJSON() ([]byte, error)         { return json.Marshal(m) }
