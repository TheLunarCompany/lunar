package harcollector

import (
	"fmt"
	"lunar/engine/utils/obfuscation"
	"net/url"
	"testing"
	"time"

	public_types "lunar/engine/streams/public-types"

	"github.com/stretchr/testify/require"
)

func TestAPIStreamObfuscator(t *testing.T) {
	md5Obfuscator := obfuscation.Obfuscator{Hasher: obfuscation.MD5Hasher{}}

	testCases := []struct {
		name                 string
		obfuscateEnabled     bool
		obfuscateExclusions  []string
		apiStream            public_types.APIStreamI
		testHeader           bool
		testQueryParam       bool
		testRequestBody      bool
		testResponseBody     bool
		testPath             bool
		expectedHeaders      map[string]string
		expectedQueryParams  map[string][]string
		expectedRequestBody  string
		expectedResponseBody string
		expectedPath         string
	}{
		{
			name:                 "Obfuscation Disabled",
			obfuscateEnabled:     false,
			apiStream:            newMockAPIStream(),
			testHeader:           true,
			testQueryParam:       true,
			testRequestBody:      true,
			testResponseBody:     true,
			testPath:             true,
			expectedHeaders:      map[string]string{"authorization": "Bearer token"},
			expectedQueryParams:  map[string][]string{"id": {"12345"}},
			expectedRequestBody:  `{"user":{"name":"Alice","id":"12345"}}`,
			expectedResponseBody: `{"user":{"name":"Bob","id":"98765"}}`,
			expectedPath:         "/users/12345/orders/5678",
		},
		{
			name:                "Obfuscate Header - exclude",
			obfuscateEnabled:    true,
			obfuscateExclusions: []string{"$.request.headers[\"Authorization\"]"},
			apiStream:           newMockAPIStream(),
			testHeader:          true,
			expectedHeaders:     map[string]string{"authorization": "Bearer token"},
		},
		{
			name:                "Obfuscate Header - One Excluded, One Obfuscated",
			obfuscateEnabled:    true,
			obfuscateExclusions: []string{"$.request.headers[\"AutHoriZAtion\"]"}, // testing also case insensitivity
			apiStream:           newMockAPIStream(),
			testHeader:          true,
			expectedHeaders: map[string]string{
				"authorization":   "Bearer token",
				"X-Custom-Header": md5Obfuscator.ObfuscateString("CustomValue"),
			},
		},
		{
			name:                "Obfuscate Query Param",
			obfuscateEnabled:    true,
			obfuscateExclusions: []string{"$.request.query_param.id"},
			apiStream:           newMockAPIStream(),
			testQueryParam:      true,
			expectedQueryParams: map[string][]string{"id": {"12345"}},
		},
		{
			name:                "Obfuscate Request Body",
			obfuscateEnabled:    true,
			obfuscateExclusions: []string{"$.request.body.user.id"},
			apiStream:           newMockAPIStream(),
			testRequestBody:     true,
			expectedRequestBody: fmt.Sprintf(
				`{"user":{"name":"%v","id":"12345"}}`,
				md5Obfuscator.ObfuscateString("Alice"),
			),
		},
		{
			name:                "Obfuscate Response Body",
			obfuscateEnabled:    true,
			obfuscateExclusions: []string{"$.response.body.user.name"},
			apiStream:           newMockAPIStream(),
			testResponseBody:    true,
			expectedResponseBody: fmt.Sprintf(
				`{"user":{"name":"Bob","id":"%v"}}`,
				md5Obfuscator.ObfuscateString("98765"),
			),
		},
		{
			name:                "Obfuscate Path Segments - exclude all",
			obfuscateEnabled:    true,
			obfuscateExclusions: []string{"$.request.path_segments[*]"},
			apiStream:           newMockAPIStream(),
			testPath:            true,
			expectedPath:        "/users/12345/orders/5678",
		},
		{
			name:             "Obfuscate Path Segments - Exclude Specific Index",
			obfuscateEnabled: true,
			obfuscateExclusions: []string{
				"$.request.path_segments[1]",
				"$.request.path_segments[3]",
			},
			apiStream: newMockAPIStream(),
			testPath:  true,
			expectedPath: fmt.Sprintf(
				"/users/%v/orders/%v",
				md5Obfuscator.ObfuscateString("12345"),
				md5Obfuscator.ObfuscateString("5678"),
			),
		},
		{
			name:             "Obfuscate Path Segments - Exclude Specific Name",
			obfuscateEnabled: true,
			obfuscateExclusions: []string{
				"$.request.path_segments[?(@ == \"users\")]",
				"$.request.path_segments[?(@ == \"orders\")]",
			},
			apiStream: newMockAPIStream(),
			testPath:  true,
			expectedPath: fmt.Sprintf(
				"/users/%v/orders/%v",
				md5Obfuscator.ObfuscateString("12345"),
				md5Obfuscator.ObfuscateString("5678"),
			),
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			obfuscator := newAPIStreamObfuscator(tc.obfuscateEnabled, tc.obfuscateExclusions, tc.apiStream)

			if tc.testHeader {
				for key, expectedValue := range tc.expectedHeaders {
					actualValue := obfuscator.ObfuscateHeader(key, tc.apiStream.GetRequest().GetHeaders()[key])
					require.Equal(t, expectedValue, actualValue, "Header obfuscation failed for key: %s", key)
				}
			}

			if tc.testQueryParam {
				for key, expectedValues := range tc.expectedQueryParams {
					actualValues := obfuscator.ObfuscateQueryParam(
						key,
						tc.apiStream.GetRequest().GetParsedURL().Query()[key],
					)
					require.Equal(t, expectedValues, actualValues, "Query param obfuscation failed for key: %s", key)
				}
			}

			if tc.testRequestBody {
				require.JSONEq(
					t,
					tc.expectedRequestBody,
					obfuscator.ObfuscateRequestBody(tc.apiStream.GetRequest().GetBody()),
				)
			}

			if tc.testResponseBody {
				require.JSONEq(
					t,
					tc.expectedResponseBody,
					obfuscator.ObfuscateResponseBody(tc.apiStream.GetResponse().GetBody()),
				)
			}

			if tc.testPath {
				require.Contains(
					t,
					obfuscator.ObfuscateURLPath(tc.apiStream.GetRequest().GetParsedURL()),
					tc.expectedPath,
				)
			}
		})
	}
}

// Mock APIStreamI implementation
type mockAPIStream struct {
	request  public_types.TransactionI
	response public_types.TransactionI
}

func newMockAPIStream() *mockAPIStream {
	return &mockAPIStream{
		request:  newMockTransaction(public_types.StreamTypeRequest),
		response: newMockTransaction(public_types.StreamTypeResponse),
	}
}

func (m *mockAPIStream) GetRequest() public_types.TransactionI  { return m.request }
func (m *mockAPIStream) GetResponse() public_types.TransactionI { return m.response }

func (m *mockAPIStream) DiscardRequest()                         {}
func (m *mockAPIStream) StoreRequest()                           {}
func (m *mockAPIStream) GetID() string                           { return "stream-id" }
func (m *mockAPIStream) GetSequenceID() string                   { return "seq-id" }
func (m *mockAPIStream) GetType() public_types.StreamType        { return public_types.StreamTypeResponse }
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
func (m *mockAPIStream) GetHost() string                          { return "example.com" }
func (m *mockAPIStream) GetBody() string                          { return "" }
func (m *mockAPIStream) GetStrStatus() string                     { return "200" }
func (m *mockAPIStream) GetMethod() string                        { return "GET" }
func (m *mockAPIStream) GetSize() int                             { return 1234 }
func (m *mockAPIStream) GetHeader(string) (string, bool)          { return "", false }
func (m *mockAPIStream) DoesHeaderValueMatch(string, string) bool { return false }
func (m *mockAPIStream) GetContext() public_types.LunarContextI   { return nil }
func (m *mockAPIStream) SetRequest(public_types.TransactionI)     {}
func (m *mockAPIStream) SetResponse(public_types.TransactionI)    {}
func (m *mockAPIStream) SetContext(public_types.LunarContextI)    {}
func (m *mockAPIStream) SetType(public_types.StreamType)          {}
func (m *mockAPIStream) SetActionsType(public_types.StreamType)   {}
func (m *mockAPIStream) WithLunarContext(public_types.LunarContextI) public_types.APIStreamI {
	return m
}

// Fully implemented mock for TransactionI
type mockTransaction struct{ reqType public_types.StreamType }

func newMockTransaction(reqType public_types.StreamType) *mockTransaction {
	return &mockTransaction{reqType: reqType}
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
func (m *mockTransaction) GetURL() string {
	return "https://example.com/users/12345/orders/5678?id=12345"
}

func (m *mockTransaction) GetParsedURL() *url.URL {
	u, _ := url.Parse(m.GetURL())
	return u
}
func (m *mockTransaction) GetScheme() string               { return "https" }
func (m *mockTransaction) GetPath() string                 { return "/path" }
func (m *mockTransaction) GetQuery() string                { return "?id=123" }
func (m *mockTransaction) GetHost() string                 { return "example.com" }
func (m *mockTransaction) GetStatus() int                  { return 200 }
func (m *mockTransaction) GetHeader(string) (string, bool) { return "", false }
func (m *mockTransaction) GetHeaders() map[string]string {
	if m.reqType == public_types.StreamTypeRequest {
		return map[string]string{
			"authorization":   "Bearer token",
			"X-Custom-Header": "CustomValue",
		}
	}
	return map[string]string{
		"Content-Type":    "application/json",
		"Cache-Control":   "no-cache",
		"X-Custom-Header": "CustomValue",
	}
}

func (m *mockTransaction) GetBody() string {
	if m.reqType == public_types.StreamTypeRequest {
		return `{"user":{"name":"Alice","id":"12345"}}`
	}
	return `{"user":{"name":"Bob","id":"98765"}}`
}
func (m *mockTransaction) GetTime() time.Time      { return time.Now() }
func (m *mockTransaction) ToJSON() ([]byte, error) { return []byte("{}"), nil }
