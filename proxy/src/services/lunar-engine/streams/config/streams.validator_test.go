package streamconfig

import (
	"testing"
)

func TestValidFlowRepresentation(t *testing.T) {
	flow := &FlowRepresentation{
		Name: "test",
		Filters: Filter{
			Name: "test",
			URL:  "test",
		},
		Processors: map[string]Processor{},
		Flow: Flow{
			Request: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
			Response: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
		},
	}
	err := validateFlowRepresentation(flow)
	if err != nil {
		t.Errorf("Expected nil, got %s", err)
	}
}

func TestMissingToConnection(t *testing.T) {
	flow := &FlowRepresentation{
		Name: "test",
		Filters: Filter{
			Name: "test",
			URL:  "test",
		},
		Processors: map[string]Processor{},
		Flow: Flow{
			Request: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
			Response: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
		},
	}
	err := validateFlowRepresentation(flow)
	if err == nil {
		t.Errorf("Expected error, got nil")
	}
}

func TestMissingFromConnection(t *testing.T) {
	flow := &FlowRepresentation{
		Name: "test",
		Filters: Filter{
			Name: "test",
			URL:  "test",
		},
		Processors: map[string]Processor{},
		Flow: Flow{
			Request: []*FlowConnection{
				{
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
			Response: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
		},
	}
	err := validateFlowRepresentation(flow)
	if err == nil {
		t.Errorf("Expected error, got nil")
	}
}

func TestMissingFlowName(t *testing.T) {
	flow := &FlowRepresentation{
		Filters: Filter{
			Name: "test",
			URL:  "test",
		},
		Processors: map[string]Processor{},
		Flow: Flow{
			Request: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
			Response: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
		},
	}
	err := validateFlowRepresentation(flow)
	if err == nil {
		t.Errorf("Expected error, got nil")
	}
}

func TestMissingFilterName(t *testing.T) {
	flow := &FlowRepresentation{
		Name: "test",
		Filters: Filter{
			URL: "test",
		},
		Processors: map[string]Processor{},
		Flow: Flow{
			Request: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
			Response: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
		},
	}
	err := validateFlowRepresentation(flow)
	if err == nil {
		t.Errorf("Expected error, got nil")
	}
}

func TestMissingFilterURL(t *testing.T) {
	flow := &FlowRepresentation{
		Name: "test",
		Filters: Filter{
			Name: "test",
		},
		Processors: map[string]Processor{},
		Flow: Flow{
			Request: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
			Response: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
		},
	}
	err := validateFlowRepresentation(flow)
	if err == nil {
		t.Errorf("Expected error, got nil")
	}
}

func TestMissingProcessorIdentifier(t *testing.T) {
	flow := &FlowRepresentation{
		Name: "test",
		Filters: Filter{
			Name: "test",
			URL:  "test",
		},
		Processors: map[string]Processor{
			"test": {},
		},
		Flow: Flow{
			Request: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
			Response: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
							At:   "test",
						},
					},
				},
			},
		},
	}
	err := validateFlowRepresentation(flow)
	if err == nil {
		t.Errorf("Expected error, got nil")
	}
}

func TestMissingStreamName(t *testing.T) {
	flow := &FlowRepresentation{
		Name: "test",
		Filters: Filter{
			Name: "test",
			URL:  "test",
		},
		Processors: map[string]Processor{},
		Flow: Flow{
			Request: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							At: "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
						},
					},
				},
			},
			Response: []*FlowConnection{
				{
					From: &Connection{
						Stream: &StreamRef{
							At: "test",
						},
					},
					To: &Connection{
						Stream: &StreamRef{
							Name: "test",
						},
					},
				},
			},
		},
	}
	err := validateFlowRepresentation(flow)
	if err == nil {
		t.Errorf("Expected error, got nil")
	}
}
