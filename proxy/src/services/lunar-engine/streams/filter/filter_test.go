package streamfilter

import (
	"lunar/engine/messages"
	streamconfig "lunar/engine/streams/config"
	streamflow "lunar/engine/streams/flow"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFilterTreeGetRelevantFlow(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1/path2", 0)

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1/path2",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)
	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result[0] != flow {
		t.Errorf("Expected %v, but got %v", flow, result)
	}
}

func TestFilterTreeGetRelevantFlowNoMatch(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1/path2", 0)

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1/path3",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)
	filterTree := NewFilterTree()
	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result != nil {
		t.Errorf("Expected %v, but got %v", nil, result)
	}
}

func TestFilterTestFilterTreeGetMostSpecificFlowBasedOnURL(t *testing.T) {
	filter1 := createFilter("FilterName1", "api.google.com/path1/path2", 0)
	filter2 := createFilter("FilterName2", "api.google.com/path1", 0)

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1/path2",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	flow1 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter1}, nil)
	flow2 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter2}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow1); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	if err := filterTree.AddFlow(flow2); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result[0] != flow1 {
		t.Errorf("Expected %v, but got %v", flow1, result)
	}
}

func TestFilterTreeGetRelevantFlowWithQueryParams(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.QueryParams = []publictypes.KeyValue{
		*publictypes.NewKeyValue("param1", "value1"),
		*publictypes.NewKeyValue("param2", "value2"),
	}

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Query:   "param1=value1&param2=value2",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()
	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result[0] != flow {
		t.Errorf("Expected %v, but got %v", flow, result)
	}
}

func TestFilterTreeGetRelevantFlowWithQueryParamsNoMatch(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.QueryParams = []publictypes.KeyValue{
		*publictypes.NewKeyValue("param1", "value1"),
		*publictypes.NewKeyValue("param2", "value2"),
	}

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Query:   "param1=value1&param2=value3",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()
	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	require.Empty(t, result, "Expected empty, but got %v", result)
}

func TestFilterTreeGetRelevantFlowWithMethod(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Method = []string{"GET"}

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result[0] != flow {
		t.Errorf("Expected %v, but got %v", flow, result)
	}
}

func TestFilterTreeGetRelevantFlowWithMethodNoMatch(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Method = []string{"GET"}

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method:  "POST",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	require.Empty(t, result, "Expected empty, but got %v", result)
}

func TestFilterTreeGetRelevantFlowWithHeaders(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Headers = []publictypes.KeyValue{
		*publictypes.NewKeyValue("header1", "value1"),
		*publictypes.NewKeyValue("header2", "value2"),
	}

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method: "GET",
		Scheme: "https",
		URL:    "api.google.com/path1",
		Headers: map[string]string{
			"header1": "value1",
			"header2": "value2",
		},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result[0] != flow {
		t.Errorf("Expected %v, but got %v", flow, result)
	}
}

func TestFilterTreeGetRelevantFlowWithHeadersNoMatch(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Headers = []publictypes.KeyValue{
		*publictypes.NewKeyValue("header1", "value1"),
		*publictypes.NewKeyValue("header2", "value2"),
	}

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method: "GET",
		Scheme: "https",
		URL:    "api.google.com/path1",
		Headers: map[string]string{
			"header1": "value1",
			"header2": "value3",
		},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	require.Empty(t, result, "Expected empty, but got %v", result)
}

func TestFilterTreeGetRelevantFlowWithStatusCode(t *testing.T) {
	filter := &streamconfig.Filter{
		Name:        "FilterName",
		URL:         "api.google.com/path1",
		QueryParams: []publictypes.KeyValue{},
		Method:      []string{},
		Headers:     []publictypes.KeyValue{},
		StatusCode:  []int{401},
	}

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 401,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result[0] != flow {
		t.Errorf("Expected %v, but got %v", flow, result)
	}
}

func TestFilterTreeGetRelevantFlowWithStatusCodeNoMatch(t *testing.T) {
	filter := &streamconfig.Filter{
		Name:        "FilterName",
		URL:         "api.google.com/path1",
		QueryParams: []publictypes.KeyValue{},
		Method:      []string{},
		Headers:     []publictypes.KeyValue{},
		StatusCode:  []int{401},
	}

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	require.Empty(t, result, "Expected empty, but got %v", result)
}

func createFilter(name, url string, statusCode int) *streamconfig.Filter {
	filter := &streamconfig.Filter{
		Name:        name,
		URL:         url,
		QueryParams: []publictypes.KeyValue{},
		Method:      []string{},
		Headers:     []publictypes.KeyValue{},
		StatusCode:  []int{},
	}
	if statusCode != 0 {
		filter.StatusCode = []int{statusCode}
	}
	return filter
}

func TestFilterTreeGetRelevantFlowWithHeadersConfigured(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Headers = []publictypes.KeyValue{
		*publictypes.NewKeyValue("header1", "value1"),
	}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.Headers = []publictypes.KeyValue{
		*publictypes.NewKeyValue("header1", "value2"),
	}

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method: "GET",
		Scheme: "https",
		URL:    "api.google.com/path1",
		Headers: map[string]string{
			"header1": "value1",
		},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)
	flow2 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter2}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}
	if err := filterTree.AddFlow(flow2); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	require.NotEmpty(t, result, "Expected empty, but got %v", result)
}

func TestFilterTreeGetRelevantFlowWithMethodsConfigured(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Method = []string{"GET"}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.Method = []string{"POST"}

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)
	flow2 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter2}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}
	if err := filterTree.AddFlow(flow2); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	require.NotEmpty(t, result, "Expected empty, but got %v", result)
}

func TestFilterTreeGetRelevantFlowWithQueryParamsConfigured(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.QueryParams = []publictypes.KeyValue{
		*publictypes.NewKeyValue("param1", "value1"),
	}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.QueryParams = []publictypes.KeyValue{
		*publictypes.NewKeyValue("param1", "value2"),
	}

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Query:   "param1=value1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)
	flow2 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter2}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}
	if err := filterTree.AddFlow(flow2); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	require.NotEmpty(t, result, "Expected empty, but got %v", result)
}

func TestFilterTreeGetRelevantFlowWithStatusCodeConfigured(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 401)
	filter.StatusCode = []int{401}
	filter2 := createFilter("FilterName", "api.google.com/path1", 200)
	filter2.StatusCode = []int{200}

	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeAny)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 401,
	}))

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)
	flow2 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter2}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}
	if err := filterTree.AddFlow(flow2); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	require.NotEmpty(t, result, "Expected empty, but got %v", result)
}

func TestFilterTreeInsertWrongHeaderConfiguration(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Headers = []publictypes.KeyValue{
		*publictypes.NewKeyValue("header1", "value1"),
	}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.Headers = []publictypes.KeyValue{
		*publictypes.NewKeyValue("header1", "value1"),
	}

	filter3 := createFilter("FilterName", "api.google.com/path1", 0)

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)
	flow2 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter2}, nil)
	flow3 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter3}, nil)

	filterTree := NewFilterTree()

	err := filterTree.AddFlow(flow)
	require.NoError(t, err, "Expected %v, but got %v", nil, err)
	err = filterTree.AddFlow(flow2)
	require.Error(t, err, "Expected %v, but got %v", nil, err)
	err = filterTree.AddFlow(flow3)
	require.Error(t, err, "Expected %v, but got %v", nil, err)
}

func TestFilterTreeInsertWrongQueryParamsConfiguration(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.QueryParams = []publictypes.KeyValue{
		*publictypes.NewKeyValue("param1", "value1"),
	}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.QueryParams = []publictypes.KeyValue{
		*publictypes.NewKeyValue("param1", "value1"),
	}

	filter3 := createFilter("FilterName", "api.google.com/path1", 0)

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)
	flow2 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter2}, nil)
	flow3 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter3}, nil)

	filterTree := NewFilterTree()

	err := filterTree.AddFlow(flow)
	require.NoError(t, err, "Expected %v, but got %v", nil, err)
	err = filterTree.AddFlow(flow2)
	require.Error(t, err, "Expected %v, but got %v", nil, err)
	err = filterTree.AddFlow(flow3)
	require.Error(t, err, "Expected %v, but got %v", nil, err)
}

func TestFilterTreeInsertWrongMethodConfiguration(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Method = []string{"GET"}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.Method = []string{"GET"}

	filter3 := createFilter("FilterName", "api.google.com/path1", 0)

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)
	flow2 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter2}, nil)
	flow3 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter3}, nil)

	filterTree := NewFilterTree()

	err := filterTree.AddFlow(flow)
	require.NoError(t, err, "Expected %v, but got %v", nil, err)
	err = filterTree.AddFlow(flow2)
	require.Error(t, err, "Expected %v, but got %v", nil, err)
	err = filterTree.AddFlow(flow3)
	require.Error(t, err, "Expected %v, but got %v", nil, err)
}

func TestFilterTreeInsertWrongStatusCodeConfiguration(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 401)
	filter.StatusCode = []int{401}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.StatusCode = []int{401}

	filter3 := createFilter("FilterName", "api.google.com/path1", 0)

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter}, nil)
	flow2 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter2}, nil)
	flow3 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filter: filter3}, nil)

	filterTree := NewFilterTree()

	err := filterTree.AddFlow(flow)
	require.NoError(t, err, "Expected %v, but got %v", nil, err)
	err = filterTree.AddFlow(flow2)
	require.Error(t, err, "Expected %v, but got %v", nil, err)
	err = filterTree.AddFlow(flow3)
	require.Error(t, err, "Expected %v, but got %v", nil, err)
}
