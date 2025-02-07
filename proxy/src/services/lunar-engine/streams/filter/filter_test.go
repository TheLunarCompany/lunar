package streamfilter

import (
	lunar_context "lunar/engine/streams/lunar-context"
	"testing"

	lunar_messages "lunar/engine/messages"
	stream_config "lunar/engine/streams/config"
	stream_flow "lunar/engine/streams/flow"
	public_types "lunar/engine/streams/public-types"
	stream_types "lunar/engine/streams/types"

	"github.com/stretchr/testify/require"
)

var sharedState = lunar_context.NewMemoryState[[]byte]()

func TestFilterTreeGetRelevantFlow(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1/path2", 0)

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1/path2",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)
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

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1/path3",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)
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

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1/path2",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow1 := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter1}, nil)
	flow2 := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter2}, nil)

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
	filter.QueryParams = []public_types.KeyValue{
		*public_types.NewKeyValue("param1", "value1"),
		*public_types.NewKeyValue("param2", "value2"),
	}

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Query:   "param1=value1&param2=value2",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)

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
	filter.QueryParams = []public_types.KeyValue{
		*public_types.NewKeyValue("param1", "value1"),
		*public_types.NewKeyValue("param2", "value2"),
	}

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Query:   "param1=value1&param2=value3",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)

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

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)

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

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "POST",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	_, found := filterTree.GetFlow(apiStream)
	require.True(t, !found, "Expected %v, but got %v", false, found)
}

func TestFilterTreeGetRelevantFlowWithHeaders(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Headers = []public_types.KeyValue{
		*public_types.NewKeyValue("header1", "value1"),
		*public_types.NewKeyValue("header2", "value2"),
	}

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method: "GET",
		Scheme: "https",
		URL:    "api.google.com/path1",
		Headers: map[string]string{
			"header1": "value1",
			"header2": "value2",
		},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)

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
	filter.Headers = []public_types.KeyValue{
		*public_types.NewKeyValue("header1", "value1"),
		*public_types.NewKeyValue("header2", "value2"),
	}

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method: "GET",
		Scheme: "https",
		URL:    "api.google.com/path1",
		Headers: map[string]string{
			"header1": "value1",
			"header2": "value3",
		},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	_, found := filterTree.GetFlow(apiStream)
	require.False(t, found, "Expected %v, but got %v", true, found)
}

func TestFilterTreeGetRelevantFlowWithStatusCode(t *testing.T) {
	filter := &stream_config.Filter{
		Name:        "FilterName",
		URL:         "api.google.com/path1",
		QueryParams: []public_types.KeyValue{},
		Method:      []string{},
		Headers:     []public_types.KeyValue{},
		StatusCode:  []int{401},
	}

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 401,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)

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
	filter := &stream_config.Filter{
		Name:        "FilterName",
		URL:         "api.google.com/path1",
		QueryParams: []public_types.KeyValue{},
		Method:      []string{},
		Headers:     []public_types.KeyValue{},
		StatusCode:  []int{401},
	}

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	_, found := filterTree.GetFlow(apiStream)
	require.False(t, found, "Expected %v, but got %v, value found: %+v", true, found)
}

func createFilter(name, url string, statusCode int) *stream_config.Filter {
	filter := &stream_config.Filter{
		Name:        name,
		URL:         url,
		QueryParams: []public_types.KeyValue{},
		Method:      []string{},
		Headers:     []public_types.KeyValue{},
		StatusCode:  []int{},
	}
	if statusCode != 0 {
		filter.StatusCode = []int{statusCode}
	}
	return filter
}

func TestFilterTreeGetRelevantFlowWithHeadersConfigured(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Headers = []public_types.KeyValue{
		*public_types.NewKeyValue("header1", "value1"),
	}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.Headers = []public_types.KeyValue{
		*public_types.NewKeyValue("header1", "value2"),
	}

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method: "GET",
		Scheme: "https",
		URL:    "api.google.com/path1",
		Headers: map[string]string{
			"header1": "value1",
		},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)
	flow2 := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter2}, nil)

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

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)
	flow2 := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter2}, nil)

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
	filter.QueryParams = []public_types.KeyValue{
		*public_types.NewKeyValue("param1", "value1"),
	}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.QueryParams = []public_types.KeyValue{
		*public_types.NewKeyValue("param1", "value2"),
	}

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Query:   "param1=value1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)
	flow2 := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter2}, nil)

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

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 401,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)
	flow2 := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter2}, nil)

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
