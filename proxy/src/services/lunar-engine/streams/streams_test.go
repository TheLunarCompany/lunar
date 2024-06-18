package streams

import (
	"lunar/engine/actions"
	streamconfig "lunar/engine/streams/config"
	"lunar/engine/streams/processors"
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils/environment"
	"os"
	"path/filepath"
	"testing"
	"time"

	testprocessors "lunar/engine/streams/flow/test-processors"

	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	prevVal := environment.SetProcessorsDirectory(filepath.Join("flow", "test-processors"))

	// Run the tests
	code := m.Run()

	// Clean up if necessary
	environment.SetProcessorsDirectory(prevVal)

	// Exit with the code from the tests
	os.Exit(code)
}

func createTestProcessorManager(t *testing.T, processorNames []string) *processors.ProcessorManager {
	processorMng := processors.NewProcessorManager()
	for _, procName := range processorNames {
		processorMng.SetFactory(procName, testprocessors.NewMockProcessor)
	}

	err := processorMng.Init()
	require.NoError(t, err)

	return processorMng
}

func createFlowRepresentation(t *testing.T, testCase string) []*streamconfig.FlowRepresentation {
	pattern := filepath.Join("flow", "test-cases", testCase, "*.yaml")
	files, fileErr := filepath.Glob(pattern)
	require.NoError(t, fileErr, "Failed to find YAML files")

	var flowReps []*streamconfig.FlowRepresentation

	for _, file := range files {
		t.Run(filepath.Base(file), func(t *testing.T) {
			flowRep, err := streamconfig.ReadStreamFlowConfig(file)
			require.NoError(t, err, "Failed to read YAML file")

			flowReps = append(flowReps, flowRep)
		})
	}
	return flowReps
}

func TestNewStream(t *testing.T) {
	stream := NewStream()
	require.NotNil(t, stream, "stream is nil")
	require.NotNil(t, stream.apiStreams, "APIStreams is nil")
	require.NotNil(t, stream.filterTree, "filterTree is nil")
}

func TestExecuteFlows(t *testing.T) {
	procMng := createTestProcessorManager(t, []string{"removePII", "readCache", "checkLimit", "generateResponse", "globalStream", "writeCache", "LogAPM", "readXXX", "writeXXX"})

	stream := NewStream()
	stream.processorsManager = procMng

	flowReps := createFlowRepresentation(t, "2-flows*")
	err := stream.createFlows(flowReps)
	require.NoError(t, err, "Failed to create flows")

	apiStream := &streamtypes.APIStream{
		Name: "APIStreamName",
		Type: streamtypes.StreamTypeRequest,
		Request: &streamtypes.OnRequest{
			Method:  "GET",
			Scheme:  "https",
			URL:     "maps.googleapis.com/maps/api/geocode/json",
			Headers: map[string]string{},
		},
		Response: &streamtypes.OnResponse{
			Status: 200,
		},
	}
	err = stream.ExecuteFlow(apiStream)
	require.NoError(t, err, "Failed to execute flow")

	apiStream.Type = streamtypes.StreamTypeResponse
	err = stream.ExecuteFlow(apiStream)
	require.NoError(t, err, "Failed to execute flow")

	// Test for 3 flows
	stream = NewStream()
	stream.processorsManager = procMng

	flowReps = createFlowRepresentation(t, "3-flows*")
	err = stream.createFlows(flowReps)
	require.NoError(t, err, "Failed to create flows")
	apiStream.Request.URL = "www.whatever.com/blabla"
	apiStream.Type = streamtypes.StreamTypeRequest

	err = stream.ExecuteFlow(apiStream)
	require.NoError(t, err, "Failed to execute flow")
}

func TestCreateFlows(t *testing.T) {
	procMng := createTestProcessorManager(t, []string{"removePII", "readCache", "checkLimit", "generateResponse", "globalStream", "writeCache", "LogAPM", "readXXX", "writeXXX"})

	stream := NewStream()
	stream.processorsManager = procMng
	flowReps := createFlowRepresentation(t, "2-flows*")

	err := stream.createFlows(flowReps)
	require.NoError(t, err, "Failed to create flows")

	stream = NewStream()
	stream.processorsManager = procMng
	flowReps = createFlowRepresentation(t, "3-flows*")
	err = stream.createFlows(flowReps)
	require.NoError(t, err, "Failed to create flows")
}

func TestRateLimitFlow(t *testing.T) {
	prevVal := environment.SetProcessorsDirectory(filepath.Join("processors", "registry"))
	defer environment.SetProcessorsDirectory(prevVal)

	prevValFlows := environment.SetStreamsFlowsDirectory(filepath.Join("flow", "flow-samples"))
	defer environment.SetStreamsFlowsDirectory(prevValFlows)

	stream := NewStream()
	err := stream.Initialize()
	require.NoError(t, err, "Failed to initialize stream")

	apiStream := &streamtypes.APIStream{
		Name: "APIStreamName",
		Type: streamtypes.StreamTypeRequest,
		Request: &streamtypes.OnRequest{
			Method:  "GET",
			Scheme:  "https",
			URL:     "maps.googleapis.com/maps/api/geocode/json",
			Headers: map[string]string{},
		},
	}

	for i := 0; i < 15; i++ {
		err = stream.ExecuteFlow(apiStream)
		require.NoError(t, err, "Failed to execute flow")

		if i > 10 {
			lastAction := stream.apiStreams.Request.Actions[len(stream.apiStreams.Request.Actions)-1]

			earlyResponse, ok := lastAction.(*actions.EarlyResponseAction)
			require.True(t, ok, "Last action is not EarlyResponseAction")
			require.Equal(t, 429, earlyResponse.Status, "Status code is not 429")
			require.Equal(t, "Too many requests", earlyResponse.Body, "Body is not Too many requests")
		}
	}

	// wait time window
	time.Sleep(5 * time.Second)

	// try again
	for i := 0; i < 5; i++ {
		err = stream.ExecuteFlow(apiStream)
		require.NoError(t, err, "Failed to execute flow")

		lastAction := stream.apiStreams.Request.Actions[len(stream.apiStreams.Request.Actions)-1]
		_, ok := lastAction.(*actions.NoOpAction)
		require.True(t, ok, "Last action is not NoOpAction")
	}

	apiStream.Response = &streamtypes.OnResponse{
		Status: 200,
	}
	apiStream.Type = streamtypes.StreamTypeResponse
	for i := 0; i < 10; i++ {
		err = stream.ExecuteFlow(apiStream)
		require.NoError(t, err, "Failed to execute flow")
	}
}
