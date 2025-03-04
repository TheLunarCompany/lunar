package processors

import (
	"lunar/engine/utils/environment"
	"os"
	"testing"

	streamconfig "lunar/engine/streams/config"
	testprocessors "lunar/engine/streams/flow/test-processors"
	publictypes "lunar/engine/streams/public-types"
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
	mng := NewProcessorManager(nil)

	err := mng.Init()
	require.NoError(t, err)

	require.NotNil(t, mng.processors["MockProcessor"])
	require.NotNil(t, mng.processors["Limiter"])
	require.NotNil(t, mng.processors["Filter"])
	require.NotNil(t, mng.processors["GenerateResponse"])
	require.NotNil(t, mng.processors["QuotaProcessorInc"])
	require.NotNil(t, mng.processors["QuotaProcessorDec"])
	require.NotNil(t, mng.processors["HARCollector"])
	require.NotNil(t, mng.processors["ReadCache"])
	require.NotNil(t, mng.processors["WriteCache"])
}

func TestProcessorManagerCreateProcessor(t *testing.T) {
	// Setup mock processors
	mng := NewProcessorManager(nil)
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
	expectedParams := map[string]*publictypes.KeyValue{
		"param1": {Key: "param1", Value: "value1"},
		"param2": {Key: "param2", Value: "value2"},
	}

	testCases := []struct {
		name           string
		procConf       publictypes.ProcessorDataI
		expectError    bool
		expectedParams map[string]*publictypes.ParamValue
	}{
		{
			name: "All parameters provided",
			procConf: &streamconfig.Processor{
				Processor: "MockProcessor",
				Parameters: []*publictypes.KeyValue{
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
			expectedParams: map[string]*publictypes.ParamValue{
				"param1": expectedParams["param1"].GetParamValue(),
				"param2": expectedParams["param2"].GetParamValue(),
			},
		},
		{
			name: "Required parameter missing",
			procConf: &streamconfig.Processor{
				Processor: "MockProcessor",
				Parameters: []*publictypes.KeyValue{
					{
						Key:   "param2",
						Value: "value2",
					},
				},
			},
			expectError: true,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			processor, err := mng.CreateProcessor(testCase.name, testCase.procConf)
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
