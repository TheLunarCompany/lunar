package processors

import (
	countllmtokens "lunar/engine/streams/processors/count-llm-tokens"
	filterprocessor "lunar/engine/streams/processors/filter-processor"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewFilterProcessor(t *testing.T) {
	metaData := &streamtypes.ProcessorMetaData{
		Name:       "testProcessor",
		Parameters: createFilterProcessorParams("http://example.com", "GET", "body", ""),
	}
	processor, err := filterprocessor.NewProcessor(metaData)
	require.NoError(t, err)
	require.NotNil(t, processor)
	require.Equal(t, "testProcessor", processor.GetName())
}

func TestFilterProcessorInit(t *testing.T) {
	metaData := &streamtypes.ProcessorMetaData{
		Name:       "testProcessor",
		Parameters: createFilterProcessorParams("http://example.com", "GET", "body", "X-Group=production"),
	}

	processor, err := filterprocessor.NewProcessor(metaData)
	require.NoError(t, err)

	// Use reflection to access private fields for testing purposes
	processorValue := reflect.ValueOf(processor).Elem()
	url := processorValue.FieldByName("url").String()
	method := processorValue.FieldByName("method").String()
	body := processorValue.FieldByName("body").String()
	headerKey := processorValue.FieldByName("headerKey").String()
	headerValue := processorValue.FieldByName("headerValue").String()

	require.Equal(t, "http://example.com", url)
	require.Equal(t, "GET", method)
	require.Equal(t, "body", body)
	require.Equal(t, "X-Group", headerKey)
	require.Equal(t, "production", headerValue)
}

func TestLLMTokensProcessor(t *testing.T) {
	metaData := &streamtypes.ProcessorMetaData{
		Name: "testProcessor",
		Parameters: map[string]streamtypes.ProcessorParam{
			"store_count_header": {Name: "store_count_header", Value: publictypes.NewParamValue("x-lunar-estimated-tokens")},
			"model":              {Name: "model", Value: publictypes.NewParamValue("gpt-4-*")},
		},
	}

	processor, err := countllmtokens.NewProcessor(metaData)
	require.NoError(t, err)

	apiStream := &mockAPIStream{
		url:        "http://example.com",
		method:     "GET",
		body:       "hallo world!",
		streamType: publictypes.StreamTypeRequest,
		headers:    map[string]string{"x-domain-access": "production"},
	}

	_, err = processor.Execute("", apiStream)
	require.NoError(t, err)

	require.Equal(t, "4", apiStream.GetHeaders()["x-lunar-estimated-tokens"])
}

func TestFilterProcessorExecute(t *testing.T) {
	testCases := []struct {
		name              string
		filterURL         string
		method            string
		body              string
		headers           map[string]string
		expectedCondition string
		apiStream         *mockAPIStream
	}{
		{
			name:              "Match all conditions",
			filterURL:         "http://example.com",
			method:            "GET",
			body:              "body",
			headers:           map[string]string{"x-domain-access": "production"},
			expectedCondition: filterprocessor.HitConditionName,
			apiStream: &mockAPIStream{
				url:     "http://example.com",
				method:  "GET",
				body:    "body",
				headers: map[string]string{"x-domain-access": "production"},
			},
		},
		{
			name:              "Header mismatch",
			filterURL:         "http://example.com",
			method:            "GET",
			body:              "body",
			headers:           map[string]string{"x-domain-access": "production"},
			expectedCondition: filterprocessor.MissConditionName,
			apiStream: &mockAPIStream{
				url:     "http://example.com",
				method:  "GET",
				body:    "body",
				headers: map[string]string{"x-domain-access": "development"},
			},
		},
		{
			name:              "Domain match",
			filterURL:         "example.com",
			expectedCondition: filterprocessor.HitConditionName,
			apiStream: &mockAPIStream{
				url: "http://example.com/test",
			},
		},
		{
			name:              "Domain wildcard match",
			filterURL:         "example.com/*",
			expectedCondition: filterprocessor.HitConditionName,
			apiStream: &mockAPIStream{
				url: "http://example.com/test",
			},
		},
		{
			name:              "Domain with path wildcard match",
			filterURL:         "example.com/test/*",
			expectedCondition: filterprocessor.HitConditionName,
			apiStream: &mockAPIStream{
				url: "http://example.com/test/something",
			},
		},
		{
			name:              "Domain with path wildcard mismatch",
			filterURL:         "example.com/test/headers/*/something",
			expectedCondition: filterprocessor.MissConditionName,
			apiStream: &mockAPIStream{
				url: "http://example.com/test/headers/not/expected",
			},
		},
		{
			name:              "Regex URL match",
			filterURL:         "http://example.com/*",
			method:            "GET",
			body:              "body",
			headers:           map[string]string{"x-domain-access": "production"},
			expectedCondition: filterprocessor.HitConditionName,
			apiStream: &mockAPIStream{
				url:     "http://example.com/test",
				method:  "GET",
				body:    "body",
				headers: map[string]string{"x-domain-access": "production"},
			},
		},
		{
			name:              "Regex URL with protocol match",
			filterURL:         "http*://example.com/headers/*/something",
			method:            "GET",
			headers:           map[string]string{"x-domain-access": "production"},
			expectedCondition: filterprocessor.HitConditionName,
			apiStream: &mockAPIStream{
				url:     "https://example.com/headers/test/something",
				method:  "GET",
				body:    "body",
				headers: map[string]string{"x-domain-access": "production"},
			},
		},
		{
			name:              "Method mismatch",
			filterURL:         "https://example.com/headers/test/something",
			method:            "POST",
			headers:           map[string]string{"x-domain-access": "production"},
			expectedCondition: filterprocessor.MissConditionName,
			apiStream: &mockAPIStream{
				url:     "https://example.com/headers/test/something",
				method:  "GET",
				body:    "body",
				headers: map[string]string{"x-domain-access": "production"},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			metaData := &streamtypes.ProcessorMetaData{
				Name:       "testProcessor",
				Parameters: createFilterProcessorParams(tc.filterURL, tc.method, tc.body, "x-domain-access="+tc.headers["x-domain-access"]),
			}

			processor, err := filterprocessor.NewProcessor(metaData)
			require.NoError(t, err)

			output, err := processor.Execute("", tc.apiStream)
			require.NoError(t, err)
			require.Equal(t, tc.expectedCondition, output.Name)
		})
	}
}

func createFilterProcessorParams(url, method, body, header string) map[string]streamtypes.ProcessorParam {
	paramMap := make(map[string]streamtypes.ProcessorParam)
	if url != "" {
		paramMap[filterprocessor.URLParam] = streamtypes.ProcessorParam{Name: filterprocessor.URLParam, Value: publictypes.NewParamValue(url)}
	}
	if method != "" {
		paramMap[filterprocessor.MethodParam] = streamtypes.ProcessorParam{Name: filterprocessor.MethodParam, Value: publictypes.NewParamValue(method)}
	}
	if body != "" {
		paramMap[filterprocessor.BodyParam] = streamtypes.ProcessorParam{Name: filterprocessor.BodyParam, Value: publictypes.NewParamValue(body)}
	}
	if header != "" {
		paramMap[filterprocessor.HeaderParam] = streamtypes.ProcessorParam{Name: filterprocessor.HeaderParam, Value: publictypes.NewParamValue(header)}
	}
	return paramMap
}
