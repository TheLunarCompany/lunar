package filterprocessor

import (
	"fmt"
	"testing"

	public_types "lunar/engine/streams/public-types"
	test_utils "lunar/engine/streams/test-utils"
	streamtypes "lunar/engine/streams/types"

	map_set "github.com/deckarep/golang-set/v2"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

type KeyValueParam struct {
	Key   string                           `yaml:"key"`
	Value []public_types.KeyValueOperation `yaml:"value"`
}

func TestCheckURLCondition(t *testing.T) {
	tests := []struct {
		name               string
		filterURLField     string
		inputURL           string
		expectedCondition  string
		expectedFilterUsed string
	}{
		{
			name:              "Regex elementor",
			filterURLField:    "api.kustomerapp.com/v1/customers/externalId=([^/]+)",
			inputURL:          "api.kustomerapp.com/v1/customers/externalId={identify}",
			expectedCondition: HitConditionName,
		},
		{
			name:              "Regex elementor2",
			filterURLField:    "api.kustomerapp.com/v1/klasses/([^/]+)/([^/]+)",
			inputURL:          "api.kustomerapp.com/v1/klasses/${kObject}/${kobjectId}",
			expectedCondition: HitConditionName,
		},
		{
			name:              "Regex elementor3",
			filterURLField:    "api.kustomerapp.com/v1/customers/([^/]+)/klasses/([^/]+)",
			inputURL:          "api.kustomerapp.com/v1/customers/{customerId}/klasses/{kObject}",
			expectedCondition: HitConditionName,
		},
		{
			name:               "Exact match",
			filterURLField:     "example.com/path",
			inputURL:           "example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com/path",
		},
		{
			name:               "Domain match",
			filterURLField:     "example.com",
			inputURL:           "http://example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com",
		},
		{
			name:               "Wildcard match",
			filterURLField:     "example.com/*",
			inputURL:           "http://example.com/path/to/resource",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com/*",
		},
		{
			name:               "Wildcard domain match",
			filterURLField:     "*.example.com",
			inputURL:           "http://sub.example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "*.example.com",
		},
		{
			name:               "Regex match",
			filterURLField:     "^example\\.com/.*$",
			inputURL:           "example.com/path/to/resource",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "^example\\.com/.*$",
		},
		{
			name:               "No match",
			filterURLField:     "example.com/path",
			inputURL:           "http://another.com/path",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "example.com/path",
		},
		{
			name:               "Invalid input URL",
			filterURLField:     "example.com/*",
			inputURL:           "://badurl",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "example.com/*",
		},
		{
			name:              "Empty filter",
			filterURLField:    "",
			inputURL:          "http://example.com/path",
			expectedCondition: "",
		},
		{
			name:               "Wildcard in middle of domain",
			filterURLField:     "example.*.com",
			inputURL:           "http://example.sub.com",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.*.com",
		},
		{
			name:               "Wildcard path",
			filterURLField:     "example.com/*/resource",
			inputURL:           "http://example.com/path/resource",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com/*/resource",
		},
		{
			name:               "Filter is a regex that doesn't match",
			filterURLField:     "^example\\.com/resource$",
			inputURL:           "example.com/path/resource",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "^example\\.com/resource$",
		},
		{
			name:               "Filter is an invalid regex",
			filterURLField:     "[example.com",
			inputURL:           "example.com/path",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "[example.com",
		},
		{
			name:               "Input URL with www prefix",
			filterURLField:     "example.com/path",
			inputURL:           "http://www.example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com/path",
		},
		{
			name:               "Filter with protocol",
			filterURLField:     "http://example.com/path",
			inputURL:           "https://example.com/path",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "http://example.com/path",
		},
		{
			name:               "Url Filter with protocol",
			filterURLField:     "http://example.com/path",
			inputURL:           "http://example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "http://example.com/path",
		},
		{
			name:               "Url Filter with protocol and www",
			filterURLField:     "http://www.example.com/path",
			inputURL:           "http://www.example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "http://www.example.com/path",
		},
		{
			name:               "Url Filter with protocol and wildcard in domain",
			filterURLField:     "http://*.example.com",
			inputURL:           "http://api.example.com",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "http://*.example.com",
		},
		{
			name:               "Url Filter with protocol and wildcard",
			filterURLField:     "http://example.com/path/*",
			inputURL:           "http://example.com/path/resource",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "http://example.com/path/*",
		},
		{
			name:               "Filter domain with different case",
			filterURLField:     "Example.COM",
			inputURL:           "http://example.com/path",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com",
		},
		{
			name:               "Input URL with query parameters",
			filterURLField:     "example.com/path",
			inputURL:           "http://example.com/path?query=123",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "example.com/path",
		},
		{
			name:               "Filter with query parameters",
			filterURLField:     "http://example.com/path?query=123",
			inputURL:           "http://example.com/path?query=123",
			expectedCondition:  HitConditionName,
			expectedFilterUsed: "http://example.com/path?query=123",
		},
		{
			name:               "Filter with wrong query parameters",
			filterURLField:     "http://example.com/path?query=123",
			inputURL:           "http://example.com/path?query=456",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "http://example.com/path?query=123",
		},
		{
			name:               "Filter with path and input URL without path",
			filterURLField:     "example.com/path",
			inputURL:           "http://example.com",
			expectedCondition:  MissConditionName,
			expectedFilterUsed: "example.com/path",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			conditions := map_set.NewSet[string]()
			apiCall := func() string { return tc.inputURL }
			var filters []string
			if tc.filterURLField != "" {
				filters = append(filters, tc.filterURLField)
			}
			checkURLCondition(conditions, apiCall, filters)

			if tc.expectedCondition == "" {
				require.True(t, conditions.IsEmpty(), "Expected conditions to be empty")
			} else {
				require.True(t, conditions.Contains(tc.expectedCondition), "Expected condition to be present")
			}
		})
	}
}

func TestFilterProcessor_QueryParamFilter(t *testing.T) {
	t.Run("one of query params matches - expected value (hit)", func(t *testing.T) {
		proc := createFilterProcessorWithKVOpParam(t, QueryParams, "query", "eq", "1", "user", "eq", "admin")
		stream := test_utils.NewMockAPIStream(
			"http://example.com/api/test?query=1&user=albert",
			map[string]string{},
			map[string]string{},
			"", // no body
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit'")
	})

	t.Run("query param match, op gt - expected value (hit)", func(t *testing.T) {
		proc := createFilterProcessorWithKVOpParam(t, QueryParams, "query", "gt", 1, "user", "eq", "admin")
		stream := test_utils.NewMockAPIStream(
			"http://example.com/api/test?query=2&user=albert",
			map[string]string{},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'miss'")
	})

	t.Run("query param match, op regex - expected value (hit)", func(t *testing.T) {
		proc := createFilterProcessorWithKVOpParam(t, QueryParams, "query", "eq", 1, "user", "regex", "^a.*t$")
		stream := test_utils.NewMockAPIStream(
			"http://example.com/api/test?query=2&user=albert",
			map[string]string{},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'miss'")
	})

	t.Run("no query param match - expected value (miss)", func(t *testing.T) {
		proc := createFilterProcessorWithKVOpParam(t, QueryParams, "query", "eq", "1", "user", "eq", "admin")
		stream := test_utils.NewMockAPIStream(
			"http://example.com/api/test?query=2&user=albert",
			map[string]string{},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, MissConditionName, procIO.Name, "expected 'miss'")
	})

	t.Run("no query param match - expected value (miss)", func(t *testing.T) {
		proc := createFilterProcessorWithKVOpParam(t, QueryParams, "query", "eq", "1", "user", "eq", "admin")
		stream := test_utils.NewMockAPIStream(
			"http://example.com/api/test",
			map[string]string{},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, MissConditionName, procIO.Name, "expected 'miss'")
	})
}

func TestFilterProcessor_MethodFilter(t *testing.T) {
	t.Run("method matches expected value (hit)", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[MethodParam] = streamtypes.ProcessorParam{
			Name:  MethodParam,
			Value: public_types.NewParamValue("GET"),
		}
		proc := createFilterProcessor(t, params)
		stream := test_utils.NewMockAPIStream(
			"http://example.com/api/test",
			map[string]string{}, // no special headers needed
			map[string]string{},
			"", // no body
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' when method matches")
	})
	t.Run("method does not match expected value (miss)", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[MethodParam] = streamtypes.ProcessorParam{
			Name:  MethodParam,
			Value: public_types.NewParamValue("POST"),
		}
		proc := createFilterProcessor(t, params)
		// The mock stream default method is GET, which should not match "POST"
		stream := test_utils.NewMockAPIStream(
			"http://example.com/api/test",
			map[string]string{},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, MissConditionName, procIO.Name, "expected 'miss' when method does not match")
	})
}

func TestFilterProcessor_BodyFilter(t *testing.T) {
	t.Run("body matches expected content (hit)", func(t *testing.T) {
		expectedBody := "HelloWorld"
		params := make(map[string]streamtypes.ProcessorParam)
		params[BodyParam] = streamtypes.ProcessorParam{
			Name:  BodyParam,
			Value: public_types.NewParamValue(expectedBody),
		}
		proc := createFilterProcessor(t, params)
		// Provide a request body that matches the filter
		stream := test_utils.NewMockAPIStream(
			"http://example.com/any",
			map[string]string{},
			map[string]string{},
			expectedBody,
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' when body content matches filter")
	})
	t.Run("body does not match expected content (miss)", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[BodyParam] = streamtypes.ProcessorParam{
			Name:  BodyParam,
			Value: public_types.NewParamValue("DifferentContent"),
		}
		proc := createFilterProcessor(t, params)
		// Provide a request body that is different from the filter content
		stream := test_utils.NewMockAPIStream(
			"http://example.com/any",
			map[string]string{},
			map[string]string{},
			"HelloWorld",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, MissConditionName, procIO.Name, "expected 'miss' when body content does not match")
	})
}

func TestFilterProcessor_EndpointFilter(t *testing.T) {
	t.Run("endpoint path matches expected value (hit)", func(t *testing.T) {
		// Filter on a specific endpoint (path)
		params := make(map[string]streamtypes.ProcessorParam)
		params[EndpointParam] = streamtypes.ProcessorParam{
			Name:  EndpointParam,
			Value: public_types.NewParamValue("/testPath"),
		}
		proc := createFilterProcessor(t, params)
		// Stream with URL that has matching path "/testPath"
		stream := test_utils.NewMockAPIStream(
			"http://example.com/testPath?query=1",
			map[string]string{},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' when endpoint path matches filter")
	})
	t.Run("endpoint path does not match expected value (miss)", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[EndpointParam] = streamtypes.ProcessorParam{
			Name:  EndpointParam,
			Value: public_types.NewParamValue("/differentPath"),
		}
		proc := createFilterProcessor(t, params)
		stream := test_utils.NewMockAPIStream(
			"http://example.com/testPath",
			map[string]string{},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, MissConditionName, procIO.Name, "expected 'miss' when endpoint path does not match")
	})
}

func TestFilterProcessor_URLFilter(t *testing.T) {
	t.Run("URL matches exactly (hit)", func(t *testing.T) {
		testURL := "http://example.com/path"
		params := make(map[string]streamtypes.ProcessorParam)
		params[URLParam] = streamtypes.ProcessorParam{
			Name:  URLParam,
			Value: public_types.NewParamValue(testURL),
		}
		proc := createFilterProcessor(t, params)
		stream := test_utils.NewMockAPIStream(
			testURL,
			map[string]string{},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' on exact URL match")
	})
	t.Run("URL matches wildcard pattern (hit)", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[URLParam] = streamtypes.ProcessorParam{
			Name:  URLParam,
			Value: public_types.NewParamValue("example.com/*"),
		}
		proc := createFilterProcessor(t, params)
		// Stream URL has same domain and a path that should match the wildcard
		stream := test_utils.NewMockAPIStream(
			"http://example.com/anything/here",
			map[string]string{},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' on URL wildcard pattern match")
	})
	t.Run("URL matches regex pattern (hit)", func(t *testing.T) {
		filterRegex := "^http://example\\.com/.*$"
		params := make(map[string]streamtypes.ProcessorParam)
		params[URLParam] = streamtypes.ProcessorParam{
			Name:  URLParam,
			Value: public_types.NewParamValue(filterRegex),
		}
		proc := createFilterProcessor(t, params)
		stream := test_utils.NewMockAPIStream(
			"http://example.com/path/123",
			map[string]string{},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' on URL regex pattern match")
	})
	t.Run("URL does not match pattern (miss)", func(t *testing.T) {
		// Filter expects a specific path, but stream URL has a different path
		params := make(map[string]streamtypes.ProcessorParam)
		params[URLParam] = streamtypes.ProcessorParam{
			Name:  URLParam,
			Value: public_types.NewParamValue("http://example.com/expected"),
		}
		proc := createFilterProcessor(t, params)
		stream := test_utils.NewMockAPIStream(
			"http://example.com/other",
			map[string]string{},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, MissConditionName, procIO.Name, "expected 'miss' when URL does not match filter")
	})
}

func TestFilterProcessor_StatusCodeFilter(t *testing.T) {
	t.Run("status code legacy in range (hit)", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[StatusCodeRangeParam] = streamtypes.ProcessorParam{
			Name:  StatusCodeRangeParam,
			Value: public_types.NewParamValue("200-299"),
		}
		proc := createFilterProcessor(t, params)
		stream := test_utils.NewMockAPIResponseStream(
			"http://example.com/status",
			map[string]string{},
			`{"dummy":"response"}`,
			200,
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' for status code in 200-299 range")
	})

	t.Run("status code in range (hit)", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[StatusCodeParam] = streamtypes.ProcessorParam{
			Name:  StatusCodeParam,
			Value: newStatusCodeParamValue("200", "201-299"),
		}
		proc := createFilterProcessor(t, params)
		stream := test_utils.NewMockAPIResponseStream(
			"http://example.com/status",
			map[string]string{},
			`{"dummy":"response"}`,
			200,
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' for status code")

		stream = test_utils.NewMockAPIResponseStream(
			"http://example.com/status",
			map[string]string{},
			`{"dummy":"response"}`,
			201,
		)
		procIO, err = proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' for status code")
	})

	t.Run("status code in range of single values (hit)", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[StatusCodeParam] = streamtypes.ProcessorParam{
			Name:  StatusCodeParam,
			Value: newStatusCodeParamValue(200, 201, 202),
		}
		proc := createFilterProcessor(t, params)
		stream := test_utils.NewMockAPIResponseStream(
			"http://example.com/status",
			map[string]string{},
			`{"dummy":"response"}`,
			200,
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' for status code")

		stream = test_utils.NewMockAPIResponseStream(
			"http://example.com/status",
			map[string]string{},
			`{"dummy":"response"}`,
			201,
		)
		procIO, err = proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' for status code")
	})

	t.Run("status code out of range (miss)", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[StatusCodeParam] = streamtypes.ProcessorParam{
			Name:  StatusCodeParam,
			Value: newStatusCodeParamValue("400-499"),
		}
		proc := createFilterProcessor(t, params)
		stream := test_utils.NewMockAPIResponseStream(
			"http://example.com/status",
			map[string]string{},
			`{"dummy":"response"}`,
			202,
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, MissConditionName, procIO.Name, "expected 'miss' for status code outside 400-499 range")
	})
}

func TestFilterProcessor_HeaderFilter(t *testing.T) {
	t.Run("testing numeric header filter", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[HeaderParam] = streamtypes.ProcessorParam{
			Name:  HeaderParam,
			Value: public_types.NewParamValue("X-Header-1 >= 123"),
		}
		proc := createFilterProcessor(t, params)
		// Stream with a header that has a numeric value
		stream := test_utils.NewMockAPIStream(
			"http://example.com/test",
			map[string]string{"X-Header-1": "200"},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' when header value is greater than 123")
	})

	t.Run("testing numeric header filter", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[HeaderParam] = streamtypes.ProcessorParam{
			Name:  HeaderParam,
			Value: public_types.NewParamValue("X-Header-1<123"),
		}
		proc := createFilterProcessor(t, params)
		// Stream with a header that has a numeric value
		stream := test_utils.NewMockAPIStream(
			"http://example.com/test",
			map[string]string{"X-Header-1": "200"},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, MissConditionName, procIO.Name, "expected 'miss' when header value is less than 123")
	})

	t.Run("header key and value match (hit)", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[HeaderParam] = streamtypes.ProcessorParam{
			Name:  HeaderParam,
			Value: public_types.NewParamValue("Authorization=Bearer token"),
		}
		proc := createFilterProcessor(t, params)
		// Stream with matching header
		stream := test_utils.NewMockAPIStream(
			"http://example.com/test",
			map[string]string{"Authorization": "Bearer token"},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' when header key and value match")
	})
	t.Run("header missing (miss)", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[HeaderParam] = streamtypes.ProcessorParam{
			Name:  HeaderParam,
			Value: public_types.NewParamValue("X-Custom-Header=expected"),
		}
		proc := createFilterProcessor(t, params)
		// Stream without the required header
		stream := test_utils.NewMockAPIStream(
			"http://example.com/test",
			map[string]string{}, // no headers present
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, MissConditionName, procIO.Name, "expected 'miss' when required header is missing")
	})
	t.Run("header present but value does not match (miss)", func(t *testing.T) {
		params := make(map[string]streamtypes.ProcessorParam)
		params[HeaderParam] = streamtypes.ProcessorParam{
			Name:  HeaderParam,
			Value: public_types.NewParamValue("Authorization=ExpectedValue"),
		}
		proc := createFilterProcessor(t, params)
		// Stream has the header key but with a different value
		stream := test_utils.NewMockAPIStream(
			"http://example.com/test",
			map[string]string{"Authorization": "DifferentValue"},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, MissConditionName, procIO.Name, "expected 'miss' when header value does not match")
	})
	t.Run("one of multiple headers matches (hit)", func(t *testing.T) {
		headerFilters := map[string]string{
			"X-Test-1": "foo",
			"X-Test-2": "bar",
		}
		params := make(map[string]streamtypes.ProcessorParam)
		params[HeaderParam+"s"] = streamtypes.ProcessorParam{
			Name:  HeaderParam + "s",
			Value: public_types.NewParamValue(headerFilters),
		}
		proc := createFilterProcessor(t, params)
		// Stream contains one of the headers with the correct value
		stream := test_utils.NewMockAPIStream(
			"http://example.com/test",
			map[string]string{"X-Test-2": "bar"},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' when at least one header filter matches")
	})
	t.Run("none of multiple headers match (miss)", func(t *testing.T) {
		headerFilters := map[string]string{
			"X-Needed-1": "foo",
			"X-Needed-2": "bar",
		}
		params := make(map[string]streamtypes.ProcessorParam)
		params[HeaderParam+"s"] = streamtypes.ProcessorParam{
			Name:  HeaderParam + "s",
			Value: public_types.NewParamValue(headerFilters),
		}
		proc := createFilterProcessor(t, params)
		// Stream missing both required headers
		stream := test_utils.NewMockAPIStream(
			"http://example.com/test",
			map[string]string{"Some-Other": "value"},
			map[string]string{},
			"",
			"",
		)
		procIO, err := proc.Execute("filter-test", stream)
		require.NoError(t, err)
		require.Equal(t, MissConditionName, procIO.Name, "expected 'miss' when none of the header filters match")
	})
}

func TestFilterProcessor_MultipleCriteria(t *testing.T) {
	tests := []struct {
		name       string
		params     map[string]streamtypes.ProcessorParam
		mockConfig struct {
			streamType public_types.StreamType
			method     string
			url        string
			endpoint   string
			headers    map[string]string
			body       string
			statusCode int
		}
		expectedCond string
	}{
		{
			name: "all filters match",
			params: map[string]streamtypes.ProcessorParam{
				MethodParam: {
					Name:  MethodParam,
					Value: public_types.NewParamValue("GET"),
				},
				HeaderParam: {
					Name:  HeaderParam,
					Value: public_types.NewParamValue("x-api-key=secret"),
				},
				URLParam: {
					Name:  URLParam,
					Value: public_types.NewParamValue("example.com/api/*"),
				},
				EndpointParam: {
					Name:  EndpointParam,
					Value: public_types.NewParamValue("/api/data"),
				},
				BodyParam: {
					Name:  BodyParam,
					Value: public_types.NewParamValue("important-data"),
				},
				StatusCodeRangeParam: {
					Name:  StatusCodeRangeParam,
					Value: public_types.NewParamValue("200-299"),
				},
			},
			mockConfig: struct {
				streamType public_types.StreamType
				method     string
				url        string
				endpoint   string
				headers    map[string]string
				body       string
				statusCode int
			}{
				streamType: public_types.StreamTypeRequest,
				method:     "GET",
				url:        "http://example.com/api/data?x=1",
				endpoint:   "/api/data",
				headers:    map[string]string{"x-api-key": "secret"},
				body:       "important-data",
				statusCode: 200,
			},
			expectedCond: HitConditionName,
		},
		{
			name: "one filter fails (body)",
			params: map[string]streamtypes.ProcessorParam{
				MethodParam: {
					Name:  MethodParam,
					Value: public_types.NewParamValue("GET"),
				},
				HeaderParam: {
					Name:  HeaderParam,
					Value: public_types.NewParamValue("x-api-key=secret"),
				},
				BodyParam: {
					Name:  BodyParam,
					Value: public_types.NewParamValue("expected-body"),
				},
			},
			mockConfig: struct {
				streamType public_types.StreamType
				method     string
				url        string
				endpoint   string
				headers    map[string]string
				body       string
				statusCode int
			}{
				streamType: public_types.StreamTypeRequest,
				method:     "GET",
				url:        "http://example.com/api/data",
				endpoint:   "/api/data",
				headers:    map[string]string{"x-api-key": "secret"},
				body:       "wrong-body",
				statusCode: 200,
			},
			expectedCond: MissConditionName,
		},
		{
			name: "multiple filters fail (status code and header)",
			params: map[string]streamtypes.ProcessorParam{
				MethodParam: {
					Name:  MethodParam,
					Value: public_types.NewParamValue("POST"),
				},
				StatusCodeRangeParam: {
					Name:  StatusCodeRangeParam,
					Value: public_types.NewParamValue("201-202"),
				},
				HeaderParam: {
					Name:  HeaderParam,
					Value: public_types.NewParamValue("Authorization=Bearer123"),
				},
			},
			mockConfig: struct {
				streamType public_types.StreamType
				method     string
				url        string
				endpoint   string
				headers    map[string]string
				body       string
				statusCode int
			}{
				streamType: public_types.StreamTypeResponse,
				method:     "POST",
				url:        "http://example.com/submit",
				endpoint:   "/submit",
				headers:    map[string]string{"Authorization": "Invalid"},
				body:       "",
				statusCode: 404,
			},
			expectedCond: MissConditionName,
		},
		{
			name: "filter passes with wildcard URL and endpoint",
			params: map[string]streamtypes.ProcessorParam{
				MethodParam: {
					Name:  MethodParam,
					Value: public_types.NewParamValue("PUT"),
				},
				URLParam: {
					Name:  URLParam,
					Value: public_types.NewParamValue("*example.com/resources/*"),
				},
				EndpointParam: {
					Name:  EndpointParam,
					Value: public_types.NewParamValue("/resources/data"),
				},
			},
			mockConfig: struct {
				streamType public_types.StreamType
				method     string
				url        string
				endpoint   string
				headers    map[string]string
				body       string
				statusCode int
			}{
				streamType: public_types.StreamTypeRequest,
				method:     "PUT",
				url:        "http://sub.example.com/resources/data?id=9",
				endpoint:   "/resources/data",
				headers:    map[string]string{},
				body:       "",
				statusCode: 200,
			},
			expectedCond: HitConditionName,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stream := test_utils.NewMockAPIStreamFull(
				tt.mockConfig.streamType,
				tt.mockConfig.method,
				tt.mockConfig.url,
				tt.mockConfig.headers,
				map[string]string{},
				tt.mockConfig.body,
				`{"response":true}`,
				tt.mockConfig.statusCode,
			)

			proc := createFilterProcessor(t, tt.params)
			procIO, err := proc.Execute("filter-test", stream)
			require.NoError(t, err)
			require.Equal(t, tt.expectedCond, procIO.Name)
		})
	}
}

func TestFilterProcessor_MultipleCriteria_Simple(t *testing.T) {
	params := make(map[string]streamtypes.ProcessorParam)
	params[MethodParam] = streamtypes.ProcessorParam{
		Name:  MethodParam,
		Value: public_types.NewParamValue("GET"),
	}
	params[HeaderParam] = streamtypes.ProcessorParam{
		Name:  HeaderParam,
		Value: public_types.NewParamValue("x-api-key=key123"),
	}
	proc := createFilterProcessor(t, params)

	// Case 1: Both criteria satisfied
	stream1 := test_utils.NewMockAPIStream(
		"https://example.com/demo",
		map[string]string{"x-api-key": "key123"},
		map[string]string{},
		"",
		`{"dummy":"response"}`,
	)
	procIO, err := proc.Execute("filter-test", stream1)
	require.NoError(t, err)
	require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' when all filter criteria match")

	// Case 2: Method matches but header is not
	stream2 := test_utils.NewMockAPIStream(
		"https://example.com/demo",
		map[string]string{"x-api-key": "key456"},
		map[string]string{},
		"",
		`{"dummy":"response"}`,
	)
	procIO, err = proc.Execute("filter-test", stream2)
	require.NoError(t, err)
	require.Equal(t, MissConditionName, procIO.Name, "expected 'miss' when any filter criterion fails")

	// Case 3: body and status code match
	body := `{"model":"gpt-4o","messages":[{"role":"developer","content":"Explain quantum mechanics. Explain the theory of relativity in simple terms"}]}`
	stream3 := test_utils.NewMockAPIStreamFull(
		public_types.StreamTypeResponse,
		"POST",
		"https://example.com/demo",
		map[string]string{"x-api-key": "key456"},
		map[string]string{},
		body,
		`{"dummy":"response"}`,
		429,
	)
	expressions := []string{
		"$.request[?(@.body.model == 'gpt-4o')]",
		"$.response[?(@.status == 429)]",
	}
	params = map[string]streamtypes.ProcessorParam{
		ExpressionsParam: {
			Name:  ExpressionsParam,
			Value: public_types.NewParamValue(expressions),
		},
	}
	proc = createFilterProcessor(t, params)
	procIO, err = proc.Execute("filter-test", stream3)
	require.NoError(t, err)
	require.Equal(t, HitConditionName, procIO.Name, "expected 'hit' when all filter criteria match")

	// Case 4: body and status code do not match
	stream4 := test_utils.NewMockAPIStreamFull(
		public_types.StreamTypeResponse,
		"POST",
		"https://example.com/demo",
		map[string]string{"x-api-key": "key456"},
		map[string]string{},
		body,
		`{"dummy":"response"}`,
		202,
	)
	procIO, err = proc.Execute("filter-test", stream4)
	require.NoError(t, err)
	require.Equal(t, MissConditionName, procIO.Name, "expected 'miss' when any filter criterion fails")
}

func TestFilterProcessor_Expressions_RequestFlow(t *testing.T) {
	tests := []struct {
		name         string
		expressions  []string
		url          string
		method       string
		headers      map[string]string
		expectedCond string
	}{
		{
			name: "method and header match (request)",
			expressions: []string{
				"$.request[?(@.method == 'GET')]",
				"$.request.headers[?(@['X-Api-Version'] == 'v1')]",
			},
			url:          "https://example.com/api/data",
			method:       "GET",
			headers:      map[string]string{"X-Api-Version": "v1"},
			expectedCond: HitConditionName,
		},
		{
			name: "header mismatch (request)",
			expressions: []string{
				"$.request.headers[?(@['Authorization'] == 'Bearer token123')]",
			},
			url:          "https://example.com/api/data",
			method:       "POST",
			headers:      map[string]string{"Authorization": "wrong-token"},
			expectedCond: MissConditionName,
		},
		{
			name: "wildcard URL match with method check",
			expressions: []string{
				"$.request[?(@.url =~ /.*\\/api\\/.*$/)]",
				"$.request[?(@.method == 'POST')]",
			},
			url:          "https://example.com/api/item",
			method:       "POST",
			headers:      map[string]string{},
			expectedCond: HitConditionName,
		},
		{
			name: "non-matching endpoint",
			expressions: []string{
				"$.request[?(@.endpoint == '/api/expected')]",
			},
			url:          "https://example.com/api/actual",
			method:       "GET",
			headers:      map[string]string{},
			expectedCond: MissConditionName,
		},
	}

	for _, tt := range tests {
		t.Run("Request: "+tt.name, func(t *testing.T) {
			params := map[string]streamtypes.ProcessorParam{
				"expressions": {
					Name:  "expressions",
					Value: public_types.NewParamValue(tt.expressions),
				},
			}
			proc := createFilterProcessor(t, params)

			stream := test_utils.NewMockAPIStreamFull(
				public_types.StreamTypeRequest,
				tt.method,
				tt.url,
				tt.headers,
				map[string]string{},
				"",
				`{}`,
				200,
			)

			procIO, err := proc.Execute("filter-test", stream)
			require.NoError(t, err)
			require.Equal(t, tt.expectedCond, procIO.Name)
		})
	}
}

func TestFilterProcessor_Expressions_ResponseFlow(t *testing.T) {
	tests := []struct {
		name         string
		expressions  []string
		statusCode   int
		headers      map[string]string
		expectedCond string
	}{
		{
			name: "status and header match (response)",
			expressions: []string{
				"$.response[?(@.status >= 200 && @.status < 300)]",
				"$.response.headers[?(@['Content-Type'] == 'application/json')]",
			},
			statusCode:   201,
			headers:      map[string]string{"Content-Type": "application/json"},
			expectedCond: HitConditionName,
		},
		{
			name: "status out of range (response)",
			expressions: []string{
				"$.response[?(@.status >= 500)]",
			},
			statusCode:   404,
			headers:      map[string]string{},
			expectedCond: MissConditionName,
		},
		{
			name: "header mismatch (response)",
			expressions: []string{
				"$.response.headers[?(@['X-Flag'] == 'on')]",
			},
			statusCode:   200,
			headers:      map[string]string{"X-Flag": "off"},
			expectedCond: MissConditionName,
		},
		{
			name: "exact status match",
			expressions: []string{
				"$.response[?(@.status == 204)]",
			},
			statusCode:   204,
			headers:      map[string]string{},
			expectedCond: HitConditionName,
		},
	}

	for _, tt := range tests {
		t.Run("Response: "+tt.name, func(t *testing.T) {
			params := map[string]streamtypes.ProcessorParam{
				"expressions": {
					Name:  "expressions",
					Value: public_types.NewParamValue(tt.expressions),
				},
			}
			proc := createFilterProcessor(t, params)

			stream := test_utils.NewMockAPIResponseStream(
				"https://example.com/response",
				tt.headers,
				`{}`,
				tt.statusCode,
			)

			procIO, err := proc.Execute("filter-test", stream)
			require.NoError(t, err)
			require.Equal(t, tt.expectedCond, procIO.Name)
		})
	}
}

func buildKeyValueParamYaml(paramKey, op1, op2, key1, key2 string, val1, val2 any) string {
	str := `
key: %v
value:
  - key: %v
    value: %v
    operation: "%v"
  - key: %v
    value: %v
    operation: "%v"
`
	return fmt.Sprintf(str, paramKey, key1, val1, op1, key2, val2, op2)
}

func createFilterProcessor(t *testing.T, params map[string]streamtypes.ProcessorParam) streamtypes.ProcessorI {
	metaData := &streamtypes.ProcessorMetaData{
		Name:       "Filter",
		Parameters: params,
	}
	proc, err := NewProcessor(metaData)
	require.NoError(t, err)
	return proc
}

func createFilterProcessorWithKVOpParam(t *testing.T,
	paramKey,
	key1, op1 string, val1 any,
	key2, op2 string, val2 any,
) streamtypes.ProcessorI {
	procParamRaw := buildKeyValueParamYaml(paramKey, op1, op2, key1, key2, val1, val2)
	var procParam KeyValueParam
	err := yaml.Unmarshal([]byte(procParamRaw), &procParam)
	require.NoError(t, err)

	require.Equal(t, paramKey, procParam.Key)
	require.Len(t, procParam.Value, 2, "expected two key-value operations")

	params := make(map[string]streamtypes.ProcessorParam)
	params[paramKey] = streamtypes.ProcessorParam{
		Name:  paramKey,
		Value: public_types.NewParamValue(procParam.Value),
	}
	return createFilterProcessor(t, params)
}

func newStatusCodeParamValue(statusCodes ...any) *public_types.ParamValue {
	newKV := public_types.NewKeyValue(StatusCodeParam, statusCodes)
	return newKV.GetParamValue()
}
