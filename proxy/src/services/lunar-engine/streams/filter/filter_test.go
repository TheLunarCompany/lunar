package streamfilter

import (
	streamconfig "lunar/engine/streams/config"
	streamflow "lunar/engine/streams/flow"
	streamtypes "lunar/engine/streams/types"
	"testing"
)

func createFilter(name, url string, statusCode int) streamconfig.Filter {
	filter := streamconfig.Filter{
		Name:        name,
		URL:         url,
		QueryParams: []streamconfig.KeyValue{},
		Method:      []string{},
		Headers:     []streamconfig.KeyValue{},
		StatusCode:  []int{},
	}
	if statusCode != 0 {
		filter.StatusCode = []int{statusCode}
	}
	return filter
}

func TestFilterTreeGetRelevantFlow(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1/path2", 0)

	apiStream := &streamtypes.APIStream{
		Name: "APIStreamName",
		Type: streamtypes.StreamTypeAny,
		Request: &streamtypes.OnRequest{
			Method:  "GET",
			Scheme:  "https",
			URL:     "api.google.com/path1/path2",
			Headers: map[string]string{},
		},
		Response: &streamtypes.OnResponse{
			Status: 200,
		},
	}

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filters: filter})
	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result != flow {
		t.Errorf("Expected %v, but got %v", flow, result)
	}
}

func TestFilterTreeGetRelevantFlowNoMatch(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1/path2", 0)

	apiStream := &streamtypes.APIStream{
		Name: "APIStreamName",
		Type: streamtypes.StreamTypeAny,
		Request: &streamtypes.OnRequest{
			Method:  "GET",
			Scheme:  "https",
			URL:     "api.google.com/path1/path3",
			Headers: map[string]string{},
		},
		Response: &streamtypes.OnResponse{
			Status: 200,
		},
	}

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filters: filter})
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

	apiStream := &streamtypes.APIStream{
		Name: "APIStreamName",
		Type: streamtypes.StreamTypeAny,
		Request: &streamtypes.OnRequest{
			Method:  "GET",
			Scheme:  "https",
			URL:     "api.google.com/path1/path2",
			Headers: map[string]string{},
		},
		Response: &streamtypes.OnResponse{
			Status: 200,
		},
	}

	flow1 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filters: filter1})
	flow2 := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filters: filter2})

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow1); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	if err := filterTree.AddFlow(flow2); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result != flow1 {
		t.Errorf("Expected %v, but got %v", flow1, result)
	}
}

func TestFilterTreeGetRelevantFlowWithQueryParams(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.QueryParams = []streamconfig.KeyValue{
		{
			Key:   "param1",
			Value: "value1",
		},
		{
			Key:   "param2",
			Value: "value2",
		},
	}

	apiStream := &streamtypes.APIStream{
		Name: "APIStreamName",
		Type: streamtypes.StreamTypeAny,
		Request: &streamtypes.OnRequest{
			Method:  "GET",
			Scheme:  "https",
			URL:     "api.google.com/path1",
			Query:   "param1=value1&param2=value2",
			Headers: map[string]string{},
		},
		Response: &streamtypes.OnResponse{
			Status: 200,
		},
	}

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filters: filter})

	filterTree := NewFilterTree()
	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result != flow {
		t.Errorf("Expected %v, but got %v", flow, result)
	}
}

func TestFilterTreeGetRelevantFlowWithQueryParamsNoMatch(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.QueryParams = []streamconfig.KeyValue{
		{
			Key:   "param1",
			Value: "value1",
		},
		{
			Key:   "param2",
			Value: "value2",
		},
	}

	apiStream := &streamtypes.APIStream{
		Name: "APIStreamName",
		Type: streamtypes.StreamTypeAny,
		Request: &streamtypes.OnRequest{
			Method:  "GET",
			Scheme:  "https",
			URL:     "api.google.com/path1",
			Query:   "param1=value1&param2=value3",
			Headers: map[string]string{},
		},
		Response: &streamtypes.OnResponse{
			Status: 200,
		},
	}

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filters: filter})

	filterTree := NewFilterTree()
	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result != nil {
		t.Errorf("Expected %v, but got %v", nil, result)
	}
}

func TestFilterTreeGetRelevantFlowWithMethod(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Method = []string{"GET"}

	apiStream := &streamtypes.APIStream{
		Name: "APIStreamName",
		Type: streamtypes.StreamTypeAny,
		Request: &streamtypes.OnRequest{
			Method:  "GET",
			Scheme:  "https",
			URL:     "api.google.com/path1",
			Headers: map[string]string{},
		},
		Response: &streamtypes.OnResponse{
			Status: 200,
		},
	}

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filters: filter})

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result != flow {
		t.Errorf("Expected %v, but got %v", flow, result)
	}
}

func TestFilterTreeGetRelevantFlowWithMethodNoMatch(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Method = []string{"GET"}

	apiStream := &streamtypes.APIStream{
		Name: "APIStreamName",
		Type: streamtypes.StreamTypeAny,
		Request: &streamtypes.OnRequest{
			Method:  "POST",
			Scheme:  "https",
			URL:     "api.google.com/path1",
			Headers: map[string]string{},
		},
		Response: &streamtypes.OnResponse{
			Status: 200,
		},
	}

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filters: filter})

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result != nil {
		t.Errorf("Expected %v, but got %v", nil, result)
	}
}

func TestFilterTreeGetRelevantFlowWithHeaders(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Headers = []streamconfig.KeyValue{
		{
			Key:   "header1",
			Value: "value1",
		},
		{
			Key:   "header2",
			Value: "value2",
		},
	}

	apiStream := &streamtypes.APIStream{
		Name: "APIStreamName",
		Type: streamtypes.StreamTypeAny,
		Request: &streamtypes.OnRequest{
			Method: "GET",
			Scheme: "https",
			URL:    "api.google.com/path1",
			Headers: map[string]string{
				"header1": "value1",
				"header2": "value2",
			},
		},
		Response: &streamtypes.OnResponse{
			Status: 200,
		},
	}

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filters: filter})

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result != flow {
		t.Errorf("Expected %v, but got %v", flow, result)
	}
}

func TestFilterTreeGetRelevantFlowWithHeadersNoMatch(t *testing.T) {
	filter := createFilter("FilterName", "api.google.com/path1", 0)
	filter.Headers = []streamconfig.KeyValue{
		{
			Key:   "header1",
			Value: "value1",
		},
		{
			Key:   "header2",
			Value: "value2",
		},
	}

	apiStream := &streamtypes.APIStream{
		Name: "APIStreamName",
		Type: streamtypes.StreamTypeAny,
		Request: &streamtypes.OnRequest{
			Method: "GET",
			Scheme: "https",
			URL:    "api.google.com/path1",
			Headers: map[string]string{
				"header1": "value1",
				"header2": "value3",
			},
		},
		Response: &streamtypes.OnResponse{
			Status: 200,
		},
	}

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filters: filter})

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result != nil {
		t.Errorf("Expected %v, but got %v", nil, result)
	}
}

func TestFilterTreeGetRelevantFlowWithStatusCode(t *testing.T) {
	filter := streamconfig.Filter{
		Name:        "FilterName",
		URL:         "api.google.com/path1",
		QueryParams: []streamconfig.KeyValue{},
		Method:      []string{},
		Headers:     []streamconfig.KeyValue{},
		StatusCode:  []int{401},
	}

	apiStream := &streamtypes.APIStream{
		Name: "APIStreamName",
		Type: streamtypes.StreamTypeAny,
		Request: &streamtypes.OnRequest{
			Method:  "GET",
			Scheme:  "https",
			URL:     "api.google.com/path1",
			Headers: map[string]string{},
		},
		Response: &streamtypes.OnResponse{
			Status: 401,
		},
	}

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filters: filter})

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result != flow {
		t.Errorf("Expected %v, but got %v", flow, result)
	}
}

func TestFilterTreeGetRelevantFlowWithStatusCodeNoMatch(t *testing.T) {
	filter := streamconfig.Filter{
		Name:        "FilterName",
		URL:         "api.google.com/path1",
		QueryParams: []streamconfig.KeyValue{},
		Method:      []string{},
		Headers:     []streamconfig.KeyValue{},
		StatusCode:  []int{401},
	}

	apiStream := &streamtypes.APIStream{
		Name: "APIStreamName",
		Type: streamtypes.StreamTypeAny,
		Request: &streamtypes.OnRequest{
			Method:  "GET",
			Scheme:  "https",
			URL:     "api.google.com/path1",
			Headers: map[string]string{},
		},
		Response: &streamtypes.OnResponse{
			Status: 200,
		},
	}

	flow := streamflow.NewFlow(nil, &streamconfig.FlowRepresentation{Filters: filter})

	filterTree := NewFilterTree()

	if err := filterTree.AddFlow(flow); err != nil {
		t.Errorf("Expected %v, but got %v", nil, err)
	}

	result := filterTree.GetFlow(apiStream)
	if result != nil {
		t.Errorf("Expected %v, but got %v", nil, result)
	}
}
