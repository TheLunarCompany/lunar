package streamconfig

import (
	"lunar/toolkit-core/configuration"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v2"
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

func TestParseYaml(t *testing.T) {
	testCases := []struct {
		name           string
		inputYAML      string
		expected       *FlowRepresentation
		expectingError bool
	}{
		{
			name: "Valid Flow Representation",
			inputYAML: `
name: ValidFlow
processors:
  proc1:
    processor: filter
    parameters:
      - key: "param1"
        value: "value1"
  proc2:
    processor: modifier
    parameters:
      - key: "param2"
        value: "value2"
flow:
  request:
    - from:
        processor:
          name: proc1
      to:
        processor:
          name: proc2
  response:
    - from:
        processor:
          name: proc2
      to:
        processor:
          name: proc1
`,
			expected: &FlowRepresentation{
				Name: "ValidFlow",
				Processors: map[string]Processor{
					"proc1": {
						Processor: "filter",
						Parameters: []KeyValue{
							{Key: "param1", Value: "value1"},
						},
					},
					"proc2": {
						Processor: "modifier",
						Parameters: []KeyValue{
							{Key: "param2", Value: "value2"},
						},
					},
				},
				Flow: Flow{
					Request: []*FlowConnection{
						{
							From: &Connection{
								Processor: &ProcessorRef{Name: "proc1"},
							},
							To: &Connection{
								Processor: &ProcessorRef{Name: "proc2"},
							},
						},
					},
					Response: []*FlowConnection{
						{
							From: &Connection{
								Processor: &ProcessorRef{Name: "proc2"},
							},
							To: &Connection{
								Processor: &ProcessorRef{Name: "proc1"},
							},
						},
					},
				},
			},
			expectingError: false,
		},
		{
			name: "Valid Minimal Flow Representation",
			inputYAML: `
name: ValidFlow
processors:
  singleProc:
    processor: noop
flow:
  request: []
  response: []
`,
			expected: &FlowRepresentation{
				Name: "ValidFlow",
				Processors: map[string]Processor{
					"singleProc": {
						Processor: "noop",
					},
				},
				Flow: Flow{
					Request:  []*FlowConnection{},
					Response: []*FlowConnection{},
				},
			},
			expectingError: false,
		},
		{
			name:           "Empty YAML",
			inputYAML:      "",
			expected:       &FlowRepresentation{},
			expectingError: false,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			data := []byte(testCase.inputYAML)
			result, err := configuration.UnmarshalPolicyRawData[FlowRepresentation](data)

			if testCase.expectingError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.Equal(t, testCase.expected, result)
			}
		})
	}
}

func TestParseYamlWithCustomUnmarshalling(t *testing.T) {
	yamlData := `
processors:
  GenerateResponseTooManyRequests:
    processor: GenerateResponse
    parameters:
      - key: status
        value: 429
      - key: body
        value: Too many requests
      - key: Content-Type
        value: text/plain
`

	var data map[string]Processor

	// Call yaml.Unmarshal which will in turn call UnmarshalYAML for KeyValue fields
	err := yaml.Unmarshal([]byte(yamlData), &data)
	require.NoError(t, err)
}
