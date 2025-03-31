package testutils

import (
	"encoding/json"
	"net/url"

	public_types "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
)

type mockAPIStream struct {
	streamType public_types.StreamType
	Request    public_types.TransactionI `json:"request,omitempty"`
	Response   public_types.TransactionI `json:"response,omitempty"`
}

func NewMockAPIStream(
	rawURL string,
	reqHeaders, respHeaders map[string]string,
	reqBody, respBody string,
) public_types.APIStreamI {
	return &mockAPIStream{
		streamType: public_types.StreamTypeRequest,
		Request:    newMockTransaction(rawURL, reqHeaders, reqBody, public_types.StreamTypeRequest),
		Response:   newMockTransaction(rawURL, respHeaders, respBody, public_types.StreamTypeResponse),
	}
}

func (m *mockAPIStream) GetRequest() public_types.TransactionI  { return m.Request }
func (m *mockAPIStream) GetResponse() public_types.TransactionI { return m.Response }

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
		return m.Request.GetHeaders()
	}
	return m.Response.GetHeaders()
}

func (m *mockAPIStream) GetURL() string {
	return m.Request.GetURL()
}

func (m *mockAPIStream) GetHost() string {
	return m.Request.GetHost()
}

func (m *mockAPIStream) GetBody() string {
	if m.GetType() == public_types.StreamTypeRequest {
		return m.Request.GetBody()
	}
	return m.Response.GetBody()
}
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

func newMockTransaction(
	rawURL string,
	headers map[string]string,
	body string,
	reqType public_types.StreamType,
) public_types.TransactionI {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return nil
	}

	bodyMap := make(map[string]any)
	if body != "" {
		if err := json.Unmarshal([]byte(body), &bodyMap); err != nil {
			log.Error().Err(err).Msg("failed to unmarshal body")
		}
	}

	if reqType == public_types.StreamTypeRequest {
		return &streamtypes.OnRequest{
			Method:      "GET",
			Scheme:      parsedURL.Scheme,
			ParsedURL:   parsedURL,
			ParsedQuery: parsedURL.Query(),
			Size:        1234,
			URL:         rawURL,
			Headers:     headers,
			Body:        body,
			BodyMap:     bodyMap,
			Path:        parsedURL.Path,
			Query:       parsedURL.RawQuery,
		}
	}
	return &streamtypes.OnResponse{
		URL:     rawURL,
		Headers: headers,
		Body:    body,
		BodyMap: bodyMap,
		Status:  200,
		Method:  "GET",
		Size:    1234,
	}
}
