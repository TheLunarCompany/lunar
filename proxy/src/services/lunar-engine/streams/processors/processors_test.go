package processors

import (
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

func TestFilterProcessorExecute(t *testing.T) {
	testCases := []struct {
		name              string
		url               string
		method            string
		body              string
		headers           map[string]string
		expectedCondition string
		apiStream         *mockAPIStream
	}{
		{
			name:              "Match all conditions",
			url:               "http://example.com",
			method:            "GET",
			body:              "body",
			headers:           map[string]string{"X-Domain-Access": "production"},
			expectedCondition: filterprocessor.HitConditionName,
			apiStream: &mockAPIStream{
				url:     "http://example.com",
				method:  "GET",
				body:    "body",
				headers: map[string]string{"X-Domain-Access": "production"},
			},
		},
		{
			name:              "Header mismatch",
			url:               "http://example.com",
			method:            "GET",
			body:              "body",
			headers:           map[string]string{"X-Domain-Access": "production"},
			expectedCondition: filterprocessor.MissConditionName,
			apiStream: &mockAPIStream{
				url:     "http://example.com",
				method:  "GET",
				body:    "body",
				headers: map[string]string{"X-Domain-Access": "development"},
			},
		},
		{
			name:              "Domain match",
			url:               "example.com",
			expectedCondition: filterprocessor.HitConditionName,
			apiStream: &mockAPIStream{
				url: "http://example.com/test",
			},
		},
		{
			name:              "Domain wildcard match",
			url:               "example.com/*",
			expectedCondition: filterprocessor.HitConditionName,
			apiStream: &mockAPIStream{
				url: "http://example.com/test",
			},
		},
		{
			name:              "Domain with path wildcard match",
			url:               "example.com/test/*",
			expectedCondition: filterprocessor.HitConditionName,
			apiStream: &mockAPIStream{
				url: "http://example.com/test/something",
			},
		},
		{
			name:              "Domain with path wildcard mismatch",
			url:               "example.com/test/headers/*/something",
			expectedCondition: filterprocessor.MissConditionName,
			apiStream: &mockAPIStream{
				url: "http://example.com/test/headers/not/expected",
			},
		},
		{
			name:              "Regex URL match",
			url:               "http://example.com/*",
			method:            "GET",
			body:              "body",
			headers:           map[string]string{"X-Domain-Access": "production"},
			expectedCondition: filterprocessor.HitConditionName,
			apiStream: &mockAPIStream{
				url:     "http://example.com/test",
				method:  "GET",
				body:    "body",
				headers: map[string]string{"X-Domain-Access": "production"},
			},
		},
		{
			name:              "Regex URL with protocol match",
			url:               "http*://example.com/headers/*/something",
			method:            "GET",
			headers:           map[string]string{"X-Domain-Access": "production"},
			expectedCondition: filterprocessor.HitConditionName,
			apiStream: &mockAPIStream{
				url:     "https://example.com/headers/test/something",
				method:  "GET",
				body:    "body",
				headers: map[string]string{"X-Domain-Access": "production"},
			},
		},
		{
			name:              "Method mismatch",
			url:               "http*://example.com/headers/*/something",
			method:            "POST",
			headers:           map[string]string{"X-Domain-Access": "production"},
			expectedCondition: filterprocessor.MissConditionName,
			apiStream: &mockAPIStream{
				url:     "https://example.com/headers/test/something",
				method:  "GET",
				body:    "body",
				headers: map[string]string{"X-Domain-Access": "production"},
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			metaData := &streamtypes.ProcessorMetaData{
				Name:       "testProcessor",
				Parameters: createFilterProcessorParams(tc.url, tc.method, tc.body, "X-Domain-Access="+tc.headers["X-Domain-Access"]),
			}

			processor, err := filterprocessor.NewProcessor(metaData)
			require.NoError(t, err)

			output, err := processor.Execute(tc.apiStream)
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
