package processors

import (
	filterprocessor "lunar/engine/streams/processors/filter-processor"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewProcessor(t *testing.T) {
	metaData := &streamtypes.ProcessorMetaData{
		Name:       "testProcessor",
		Parameters: createFilterProcessorParams("http://example.com", "GET", "body", ""),
	}
	processor, err := filterprocessor.NewProcessor(metaData)
	require.NoError(t, err)
	require.NotNil(t, processor)
	require.Equal(t, "testProcessor", processor.GetName())
}

func TestProcessorInit(t *testing.T) {
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

func TestProcessorExecute(t *testing.T) {
	metaData := &streamtypes.ProcessorMetaData{
		Name:       "testProcessor",
		Parameters: createFilterProcessorParams("http://example.com", "GET", "body", "X-Group=production"),
	}

	processor, err := filterprocessor.NewProcessor(metaData)
	require.NoError(t, err)

	apiStream := &mockAPIStream{
		url:     "http://example.com",
		method:  "GET",
		body:    "body",
		headers: map[string]string{"X-Group": "production"},
	}

	output, err := processor.Execute(apiStream)
	require.NoError(t, err)
	require.Equal(t, filterprocessor.HitConditionName, output.Name)

	apiStream.headers["X-Group"] = "development"

	output, err = processor.Execute(apiStream)
	require.NoError(t, err)
	require.Equal(t, filterprocessor.MissConditionName, output.Name)
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
