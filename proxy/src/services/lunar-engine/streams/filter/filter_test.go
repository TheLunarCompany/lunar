package streamfilter

import (
	lunarContext "lunar/engine/streams/lunar-context"
	"testing"

	lunarMessages "lunar/engine/messages"
	streamConfig "lunar/engine/streams/config"
	streamFlow "lunar/engine/streams/flow"
	publicTypes "lunar/engine/streams/public-types"
	streamTypes "lunar/engine/streams/types"

	"github.com/stretchr/testify/require"
)

func TestFilterTreeGetRelevantFlow(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1/path2", 0)

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1/path2",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)
	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result, found := filterTree.GetFlow(apiStream)
	if !found {
		t.Errorf("Expected %v, but got %v", true, found)
	}
	if userFlow, found := result.GetUserFlow(); found {
		if userFlow[0] != flow {
			t.Errorf("Expected %v, but got %v", flow, result)
		}
	} else {
		t.Errorf("Expected %v, but got %v", true, found)
	}
}

func TestFilterTreeGetRelevantFlowNoMatch(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1/path2", 0)

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1/path3",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)
	filterTree := NewFilterTree()
	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	_, found := filterTree.GetFlow(apiStream)
	if found {
		t.Errorf("Expected %v, but got %v", false, found)
	}
}

func TestFilterTestFilterTreeGetMostSpecificFlowBasedOnURL(t *testing.T) {
	filter1 := createFilter("FilterName1", "api.google.com/path1/path2", 0)
	filter2 := createFilter("FilterName2", "api.google.com/path1", 0)

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1/path2",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow1 := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter1}, nil)
	flow2 := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter2}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow1); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	if err := filterTree.AddFlow(flow2); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result, found := filterTree.GetFlow(apiStream)
	if !found {
		t.Errorf("Expected %v, but got %v", true, found)
	}
	if userFlow, found := result.GetUserFlow(); found {
		if userFlow[0] != flow1 {
			t.Errorf("Expected %v, but got %v", flow1, result)
		}
	} else {
		t.Errorf("Expected %v, but got %v", true, found)
	}
}

func TestFilterTreeGetRelevantFlowWithQueryParams(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.QueryParams = []publicTypes.KeyValue{
		*publicTypes.NewKeyValue("param1", "value1"),
		*publicTypes.NewKeyValue("param2", "value2"),
	}

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Query:   "param1=value1&param2=value2",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()
	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result, found := filterTree.GetFlow(apiStream)
	if !found {
		t.Errorf("Expected %v, but got %v", true, found)
	}
	if userFlow, found := result.GetUserFlow(); found {
		if userFlow[0] != flow {
			t.Errorf("Expected %v, but got %v", flow, result)
		}
	} else {
		t.Errorf("Expected %v, but got %v", true, found)
	}
}

func TestFilterTreeGetRelevantFlowWithQueryParamsNoMatch(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.QueryParams = []publicTypes.KeyValue{
		*publicTypes.NewKeyValue("param1", "value1"),
		*publicTypes.NewKeyValue("param2", "value2"),
	}

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Query:   "param1=value1&param2=value3",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()
	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	_, found := filterTree.GetFlow(apiStream)
	if found {
		t.Errorf("Expected %v, but got %v", false, found)
	}
}

func TestFilterTreeGetRelevantFlowWithMethod(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Method = []string{"GET"}

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result, found := filterTree.GetFlow(apiStream)
	if !found {
		t.Errorf("Expected %v, but got %v", true, found)
	}
	if userFlow, found := result.GetUserFlow(); found {
		if userFlow[0] != flow {
			t.Errorf("Expected %v, but got %v", flow, result)
		}
	} else {
		t.Errorf("Expected %v, but got %v", true, found)
	}
}

func TestFilterTreeGetRelevantFlowWithMethodNoMatch(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Method = []string{"GET"}

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method:  "POST",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	_, found := filterTree.GetFlow(apiStream)
	require.True(t, !found, "Expected %v, but got %v", false, found)
}

func TestFilterTreeGetRelevantFlowWithHeaders(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Headers = []publicTypes.KeyValue{
		*publicTypes.NewKeyValue("header1", "value1"),
		*publicTypes.NewKeyValue("header2", "value2"),
	}

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method: "GET",
		Scheme: "https",
		URL:    "api.google.com/path1",
		Headers: map[string]string{
			"header1": "value1",
			"header2": "value2",
		},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result, found := filterTree.GetFlow(apiStream)
	require.True(t, found, "Expected %v, but got %v", true, found)
	if userFlow, found := result.GetUserFlow(); found {
		if userFlow[0] != flow {
			t.Errorf("Expected %v, but got %v", flow, result)
		}
	} else {
		t.Errorf("Expected %v, but got %v", true, found)
	}
}

func TestFilterTreeGetRelevantFlowWithHeadersNoMatch(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Headers = []publicTypes.KeyValue{
		*publicTypes.NewKeyValue("header1", "value1"),
		*publicTypes.NewKeyValue("header2", "value2"),
	}

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method: "GET",
		Scheme: "https",
		URL:    "api.google.com/path1",
		Headers: map[string]string{
			"header1": "value1",
			"header2": "value3",
		},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	_, found := filterTree.GetFlow(apiStream)
	require.False(t, found, "Expected %v, but got %v", true, found)
}

func TestFilterTreeGetRelevantFlowWithStatusCode(t *testing.T) {
	filter := &streamConfig.Filter{
		Name:        "FilterName",
		URL:         "api.google.com/path1",
		QueryParams: []publicTypes.KeyValue{},
		Method:      []string{},
		Headers:     []publicTypes.KeyValue{},
		StatusCode:  []int{401},
	}

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 401,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result, found := filterTree.GetFlow(apiStream)
	require.True(t, found, "Expected %v, but got %v", true, found)
	if userFlow, found := result.GetUserFlow(); found {
		if userFlow[0] != flow {
			t.Errorf("Expected %v, but got %v", flow, result)
		}
	} else {
		t.Errorf("Expected %v, but got %v", true, found)
	}
}

func TestFilterTreeGetRelevantFlowWithStatusCodeNoMatch(t *testing.T) {
	filter := &streamConfig.Filter{
		Name:        "FilterName",
		URL:         "api.google.com/path1",
		QueryParams: []publicTypes.KeyValue{},
		Method:      []string{},
		Headers:     []publicTypes.KeyValue{},
		StatusCode:  []int{401},
	}

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 200,
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	_, found := filterTree.GetFlow(apiStream)
	require.False(t, found, "Expected %v, but got %v, value found: %+v", true, found)
}

func createFilter(name, url string, statusCode int) *streamConfig.Filter {
	filter := &streamConfig.Filter{
		Name:        name,
		URL:         url,
		QueryParams: []publicTypes.KeyValue{},
		Method:      []string{},
		Headers:     []publicTypes.KeyValue{},
		StatusCode:  []int{},
	}
	if statusCode != 0 {
		filter.StatusCode = []int{statusCode}
	}
	return filter
}

func TestFilterTreeGetRelevantFlowWithHeadersConfigured(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Headers = []publicTypes.KeyValue{
		*publicTypes.NewKeyValue("header1", "value1"),
	}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.Headers = []publicTypes.KeyValue{
		*publicTypes.NewKeyValue("header1", "value2"),
	}

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method: "GET",
		Scheme: "https",
		URL:    "api.google.com/path1",
		Headers: map[string]string{
			"header1": "value1",
		},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)
	flow2 := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter2}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}
	if err := filterTree.AddFlow(flow2); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	_, found := filterTree.GetFlow(apiStream)
	require.True(t, found, "Expected %v, but got %v", true, found)
}

func TestFilterTreeGetRelevantFlowWithMethodsConfigured(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Method = []string{"GET"}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.Method = []string{"POST"}

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)
	flow2 := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter2}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}
	if err := filterTree.AddFlow(flow2); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result, _ := filterTree.GetFlow(apiStream)
	require.NotEmpty(t, result, "Expected empty, but got %v", result)
}

func TestFilterTreeGetRelevantFlowWithQueryParamsConfigured(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.QueryParams = []publicTypes.KeyValue{
		*publicTypes.NewKeyValue("param1", "value1"),
	}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.QueryParams = []publicTypes.KeyValue{
		*publicTypes.NewKeyValue("param1", "value2"),
	}

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Query:   "param1=value1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)
	flow2 := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter2}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}
	if err := filterTree.AddFlow(flow2); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result, _ := filterTree.GetFlow(apiStream)
	require.NotEmpty(t, result, "Expected empty, but got %v", result)
}

func TestFilterTreeGetRelevantFlowWithStatusCodeConfigured(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 401)
	filter.StatusCode = []int{401}
	filter2 := createFilter("FilterName", "api.google.com/path1", 200)
	filter2.StatusCode = []int{200}

	apiStream := streamTypes.NewAPIStream("APIStreamName", publicTypes.StreamTypeAny)
	apiStream.SetResponse(streamTypes.NewResponse(lunarMessages.OnResponse{
		Status: 401,
	}))
	apiStream.SetRequest(streamTypes.NewRequest(lunarMessages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunarContext.NewLunarContext(lunarContext.NewContext()))

	flow := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter}, nil)
	flow2 := streamFlow.NewFlow(nil, &streamConfig.FlowRepresentation{Filter: filter2}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}
	if err := filterTree.AddFlow(flow2); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result, _ := filterTree.GetFlow(apiStream)
	require.NotEmpty(t, result, "Expected empty, but got %v", result)
}
