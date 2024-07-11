package processors

import (
	"lunar/engine/utils/environment"
	"os"
	"testing"

	streamconfig "lunar/engine/streams/config"
	testprocessors "lunar/engine/streams/flow/test-processors"
	streamtypes "lunar/engine/streams/types"

	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	prevVal := environment.SetProcessorsDirectory(".")

	// Run the tests
	code := m.Run()

	// Clean up if necessary
	environment.SetProcessorsDirectory(prevVal)

	// Exit with the code from the tests
	os.Exit(code)
}

func TestProcessorManagerInit(t *testing.T) {
	mng := NewProcessorManager()

	err := mng.Init()
	require.NoError(t, err)

	require.Len(t, mng.processors, 3)
	require.NotNil(t, mng.processors["MockProcessor"])
	require.NotNil(t, mng.processors["BasicRateLimiter"])
	require.NotNil(t, mng.processors["GenerateResponse"])
}

func TestProcessorManagerCreateProcessor(t *testing.T) {
	// Setup mock processors
	mng := NewProcessorManager()
	mng.SetFactory("MockProcessor", testprocessors.NewMockProcessor)
	mng.SetFactory("MockProcessor2", testprocessors.NewMockProcessor)
	mng.processors = map[string]*streamtypes.ProcessorDefinition{
		"MockProcessor": {
			Name: "MockProcessor",
			Parameters: map[string]streamtypes.ProcessorParamDefinition{
				"param1": {Required: true, Default: "default"},
				"param2": {Required: false, Default: "default2"},
			},
		},
		"MockProcessor2": {
			Name: "MockProcessor2",
			Parameters: map[string]streamtypes.ProcessorParamDefinition{
				"param1": {Required: false},
			},
		},
	}

	testCases := []struct {
		name           string
		procConf       streamconfig.Processor
		expectError    bool
		expectedParams map[string]string
	}{
		{
			name: "All parameters provided",
			procConf: streamconfig.Processor{
				Processor: "MockProcessor",
				Parameters: []streamconfig.KeyValue{
					{
						Key:   "param1",
						Value: "value1",
					},
					{
						Key:   "param2",
						Value: "value2",
					},
				},
			},
			expectError: false,
			expectedParams: map[string]string{
				"param1": "value1",
				"param2": "value2",
			},
		},
		{
			name: "Required parameter missing",
			procConf: streamconfig.Processor{
				Processor: "MockProcessor",
				Parameters: []streamconfig.KeyValue{
					{
						Key:   "param2",
						Value: "value2",
					},
				},
			},
			expectError: true,
		},
		{
			name: "Optional parameter missing, default used",
			procConf: streamconfig.Processor{
				Processor: "MockProcessor",
				Parameters: []streamconfig.KeyValue{
					{
						Key:   "param1",
						Value: "value1",
					},
				},
			},
			expectError: false,
			expectedParams: map[string]string{
				"param1": "value1",
				"param2": "default2",
			},
		},
		{
			name: "parameter and default are missing",
			procConf: streamconfig.Processor{
				Processor:  "MockProcessor2",
				Parameters: []streamconfig.KeyValue{},
			},
			expectError: true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			processor, err := mng.CreateProcessor(testCase.procConf)
			if testCase.expectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				require.NotNil(t, processor)

				// Check parameters
				mockProc := processor.(*testprocessors.MockProcessor)
				for key, expectedValue := range testCase.expectedParams {
					require.Equal(t, expectedValue, mockProc.Metadata.Parameters[key].Value)
				}
			}
		})
	}
}
