package streamfilter

import (
	internaltypes "lunar/engine/streams/internal-types"
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
	filter.QueryParams = []public_types.KeyValueOperation{
		*public_types.NewKeyValueOperation("param1", "value1", public_types.OpParamEq),
		*public_types.NewKeyValueOperation("param2", "value2", public_types.OpParamEq),
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
	filter.QueryParams = []public_types.KeyValueOperation{
		*public_types.NewKeyValueOperation("param1", "value1", public_types.OpParamEq),
		*public_types.NewKeyValueOperation("param2", "value2", public_types.OpParamEq),
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
	err := filterTree.AddFlow(flow)
	require.NoError(t, err)

	_, found := filterTree.GetFlow(apiStream)
	require.True(t, found, "Expected %v, but got %v", true, found) //query params use OR operand

	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Query:   "param1=value55&param2=value3",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow = stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)

	filterTree = NewFilterTree()
	err = filterTree.AddFlow(flow)
	require.NoError(t, err)

	_, found = filterTree.GetFlow(apiStream)
	require.False(t, found)
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
	filter.Headers = []public_types.KeyValueOperation{
		*public_types.NewKeyValueOperation("header1", "value1", public_types.OpParamEq),
		*public_types.NewKeyValueOperation("header2", "value2", public_types.OpParamEq),
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
	filter.Headers = []public_types.KeyValueOperation{
		*public_types.NewKeyValueOperation("header1", "value1", public_types.OpParamEq),
		*public_types.NewKeyValueOperation("header2", "value2", public_types.OpParamEq),
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
		QueryParams: []public_types.KeyValueOperation{},
		Method:      []string{},
		Headers:     []public_types.KeyValueOperation{},
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

func TestFilterTreeGetRelevantFlowWithAcceptAllStatusCode(t *testing.T) {
	filter := &stream_config.Filter{
		Name:        "FilterName",
		URL:         "api.google.com/path1",
		QueryParams: []public_types.KeyValueOperation{},
		Method:      []string{},
		Headers:     []public_types.KeyValueOperation{},
		StatusCode:  []int{},
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
		QueryParams: []public_types.KeyValueOperation{},
		Method:      []string{},
		Headers:     []public_types.KeyValueOperation{},
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

func TestFilterTreeGetRelevantFlowWithHeadersConfigured(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Headers = []public_types.KeyValueOperation{
		*public_types.NewKeyValueOperation("header1", "value1", public_types.OpParamEq),
	}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.Headers = []public_types.KeyValueOperation{
		*public_types.NewKeyValueOperation("header1", "value2", public_types.OpParamEq),
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
	filter.QueryParams = []public_types.KeyValueOperation{
		*public_types.NewKeyValueOperation("param1", "value1", public_types.OpParamEq),
	}
	filter2 := createFilter("FilterName", "api.google.com/path1", 0)
	filter2.QueryParams = []public_types.KeyValueOperation{
		*public_types.NewKeyValueOperation("param1", "value2", public_types.OpParamEq),
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

func TestMultipleFlowsRetrievedWhenFilterMatchesMoreThenOneFlow(t *testing.T) {
	filterTree := NewFilterTree()

	filter := createFilter("FilterName", "api.google.com/*", 0)
	filter2 := createFilter("FilterName", "api.google.com/path1/*", 0)

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 401,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1/something",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)
	flow2 := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter2}, nil)
	flow3 := stream_flow.NewFlow(
		nil,
		&stream_config.FlowRepresentation{Filter: filter, Type: internaltypes.SystemFlowStart},
		nil,
	)

	err := filterTree.AddFlow(flow)
	require.NoError(t, err)

	err = filterTree.AddFlow(flow2)
	require.NoError(t, err)

	err = filterTree.AddFlow(flow3)
	require.NoError(t, err)

	result, found := filterTree.GetFlow(apiStream)
	require.True(t, found)

	userFlows, found := result.GetUserFlow()
	require.True(t, found)
	require.Len(t, userFlows, 2)

	systemFlow, found := result.GetSystemFlowStart()
	require.True(t, found)
	require.Len(t, systemFlow, 1)
}

func TestHeaderFilterWillAllOperationTypesTrue(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Headers = []public_types.KeyValueOperation{
		*public_types.NewKeyValueOperation("test-eq", 0, public_types.OpParamEq),
		*public_types.NewKeyValueOperation("test-neq", "nope", public_types.OpParamNeq),
		*public_types.NewKeyValueOperation("test-gt", 10, public_types.OpParamGt),
		*public_types.NewKeyValueOperation("test-lt", 100, public_types.OpParamLt),
		*public_types.NewKeyValueOperation("test-gte", 10, public_types.OpParamGte),
		*public_types.NewKeyValueOperation("test-lte", 1000, public_types.OpParamLte),
		*public_types.NewKeyValueOperation("test-exists", "", public_types.OpParamExists),
		*public_types.NewKeyValueOperation("test-not-exists", "", public_types.OpParamNotExists),
		*public_types.NewKeyValueOperation("test-regex", "^foo.*bar$", public_types.OpParamRegex),
	}
	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method: "GET",
		Scheme: "https",
		URL:    "api.google.com/path1",
		Headers: map[string]string{
			"test-eq":      "0",
			"test-neq":     "something",
			"test-gt":      "11",
			"test-gte":     "10",
			"test-lt":      "99",
			"test-lte":     "100",
			"test-regex":   "foozzzbar",
			"test-between": "15",
			"test-exists":  "non-empty",
		},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result, _ := filterTree.GetFlow(apiStream)
	require.NotEmpty(t, result, "Expected not empty, but got %v", result)
}

func TestQueryParamsFilterWithAllOperationTypesTrue(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.QueryParams = []public_types.KeyValueOperation{
		*public_types.NewKeyValueOperation("test-eq", "0", public_types.OpParamEq),
		*public_types.NewKeyValueOperation("test-neq", "nope", public_types.OpParamNeq),
		*public_types.NewKeyValueOperation("test-gt", "10", public_types.OpParamGt),
		*public_types.NewKeyValueOperation("test-lt", "100", public_types.OpParamLt),
		*public_types.NewKeyValueOperation("test-gte", "10", public_types.OpParamGte),
		*public_types.NewKeyValueOperation("test-lte", "1000", public_types.OpParamLte),
		*public_types.NewKeyValueOperation("test-exists", "", public_types.OpParamExists),
		*public_types.NewKeyValueOperation("test-not-exists", "", public_types.OpParamNotExists),
		*public_types.NewKeyValueOperation("test-regex", "^foo.*bar$", public_types.OpParamRegex),
	}
	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeAny, sharedState)
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "api.google.com/path1",
		Query:   "test-eq=0&test-neq=something&test-gt=11&test-gte=10&test-lt=99&test-lte=100&test-regex=foozzzbar&test-exists=non-empty",
		Headers: map[string]string{},
	}))
	apiStream.SetContext(lunar_context.NewLunarContext(lunar_context.NewContext()))

	flow := stream_flow.NewFlow(nil, &stream_config.FlowRepresentation{Filter: filter}, nil)

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result, _ := filterTree.GetFlow(apiStream)
	require.NotEmpty(t, result, "Expected not empty, but got %v", result)
}

func createFilter(name, url string, statusCode int) *stream_config.Filter {
	filter := &stream_config.Filter{
		Name:        name,
		URL:         url,
		QueryParams: []public_types.KeyValueOperation{},
		Method:      []string{},
		Headers:     []public_types.KeyValueOperation{},
		StatusCode:  []int{},
	}
	if statusCode != 0 {
		filter.StatusCode = []int{statusCode}
	}
	return filter
}
