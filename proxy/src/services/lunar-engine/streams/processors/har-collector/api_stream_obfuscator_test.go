package harcollector

import (
	"fmt"
	test_utils "lunar/engine/streams/test-utils"
	"lunar/engine/utils/obfuscation"
	"testing"

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

func newMockAPIStream() public_types.APIStreamI {
	return test_utils.NewMockAPIStream(
		"https://example.com/users/12345/orders/5678?id=12345",
		map[string]string{
			"authorization":   "Bearer token",
			"X-Custom-Header": "CustomValue",
		},
		map[string]string{
			"Content-Type":    "application/json",
			"Cache-Control":   "no-cache",
			"X-Custom-Header": "CustomValue",
		},
		`{"user":{"name":"Alice","id":"12345"}}`,
		`{"user":{"name":"Bob","id":"98765"}}`,
	)
}
