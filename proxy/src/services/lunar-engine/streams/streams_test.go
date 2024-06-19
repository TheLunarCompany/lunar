package streams

import (
	"lunar/engine/actions"
	streamconfig "lunar/engine/streams/config"
	testprocessors "lunar/engine/streams/flow/test-processors"
	"lunar/engine/streams/processors"
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils/environment"
	"os"
	"path/filepath"
	"testing"
	"time"

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

func TestLunarGlobalContextUsage(t *testing.T) {
	procMng := createTestProcessorManagerWithFactories(t, []string{"processor1", "processor2"},
		testprocessors.NewMockProcessorUsingGlobalContextSrc,
		testprocessors.NewMockProcessorUsingGlobalContextDest,
	)

	contextManager := streamtypes.NewContextManager()
	globalContext := contextManager.GetGlobalContext()
	err := globalContext.Set(testprocessors.GlobalKey, testprocessors.GlobalValue)
	require.NoError(t, err, "Failed to set global context value")

	stream := createStreamForContextTest(t, procMng)
	apiStream := createAPIStreamForContextTest()

	executionContext := getExecutionContext(stream, apiStream)

	require.Equal(t, globalContext, executionContext.GetGlobalContext(), "Global context is not the same")

	err = executionContext.GetGlobalContext().Set(testprocessors.GlobalKey, testprocessors.GlobalValue)
	require.NoError(t, err, "Failed to set global context value")

	runContextTest(t, stream, apiStream)

	// Check if the global context has been used
	actualValue, err := contextManager.GetGlobalContext().Get(testprocessors.GlobalKey)
	require.NoError(t, err, "Failed to get global context value")
	require.Equal(t, testprocessors.UsedValue, actualValue, "Global context is not used")

	executionContext = getExecutionContext(stream, apiStream)
	require.Equal(t, globalContext, executionContext.GetGlobalContext(), "Global context is not the same")
}

func TestLunarFlowContextUsage(t *testing.T) {
	procMng := createTestProcessorManagerWithFactories(t, []string{"processor1", "processor2"},
		testprocessors.NewMockProcessorUsingFlowContextSrc,
		testprocessors.NewMockProcessorUsingFlowContextDest,
	)

	stream := createStreamForContextTest(t, procMng)
	apiStream := createAPIStreamForContextTest()
	runContextTest(t, stream, apiStream)

	// Check if the flow context has been used
	actualValue, err := getExecutionContext(stream, apiStream).GetFlowContext().Get(testprocessors.FlowKey)
	require.NoError(t, err, "Failed to get flow context value")
	require.Equal(t, testprocessors.UsedValue, actualValue, "Flow context is not used")
}

func TestLunarTransactionalContextUsage(t *testing.T) {
	procMng := createTestProcessorManagerWithFactories(t, []string{"processor1", "processor2"},
		testprocessors.NewMockProcessorUsingTrContextSrc,
		testprocessors.NewMockProcessorUsingTrContextDest,
	)

	stream := createStreamForContextTest(t, procMng)
	apiStream := createAPIStreamForContextTest()
	runContextTest(t, stream, apiStream)

	ctx := getExecutionContext(stream, apiStream)

	// Check that the transactional context was removed
	require.Nil(t, ctx.GetTransactionalContext(), "Transactional context is not removed")

	// Check if the transaction context has been used
	actualValue, err := ctx.GetGlobalContext().Get(testprocessors.TransactionalKey)
	require.NoError(t, err, "Failed to get context value")
	require.Equal(t, testprocessors.UsedValue, actualValue, "Transactional context is not used")
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
		Name:    "APIStreamName",
		Type:    streamtypes.StreamTypeRequest,
		Context: streamtypes.NewLunarContext(streamtypes.NewContext()),
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

func createTestProcessorManager(t *testing.T, processorNames []string) *processors.ProcessorManager {
	return createTestProcessorManagerWithFactories(t, processorNames, testprocessors.NewMockProcessor)
}

func createTestProcessorManagerWithFactories(t *testing.T, processorNames []string, factories ...processors.ProcessorFactory) *processors.ProcessorManager {
	processorMng := processors.NewProcessorManager()
	for i, procName := range processorNames {
		factory := factories[0]
		if len(factories) > 1 {
			factory = factories[i]
		}
		processorMng.SetFactory(procName, factory)
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

func createStreamForContextTest(t *testing.T, procMng *processors.ProcessorManager) *Stream {
	stream := NewStream()
	stream.processorsManager = procMng

	globalStreamRefStart := &streamconfig.StreamRef{Name: streamtypes.GlobalStream, At: "start"}
	globalStreamRefEnd := &streamconfig.StreamRef{Name: streamtypes.GlobalStream, At: "end"}
	processorRef1 := &streamconfig.ProcessorRef{Name: "processor1"}
	processorRef2 := &streamconfig.ProcessorRef{Name: "processor2"}
	flowReps := []*streamconfig.FlowRepresentation{
		{
			Filters: streamconfig.Filter{URL: "maps.googleapis.com/*"},
			Name:    "GraphWithEntryPoints",
			Processors: map[string]streamconfig.Processor{
				"processor1": {Processor: "processor1"},
				"processor2": {Processor: "processor2"},
			},
			Flow: streamconfig.Flow{
				Request: []*streamconfig.FlowConnection{
					{
						From: &streamconfig.Connection{Stream: globalStreamRefStart},
						To:   &streamconfig.Connection{Processor: processorRef1},
					},
					{
						From: &streamconfig.Connection{Processor: processorRef1},
						To:   &streamconfig.Connection{Processor: processorRef2},
					},
					{
						From: &streamconfig.Connection{Processor: processorRef2},
						To:   &streamconfig.Connection{Stream: globalStreamRefEnd},
					},
				},
			},
		},
	}
	err := stream.createFlows(flowReps)
	require.NoError(t, err, "Failed to create flows")

	return stream
}

func createAPIStreamForContextTest() *streamtypes.APIStream {
	return &streamtypes.APIStream{
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
}

func runContextTest(t *testing.T, stream *Stream, apiStream *streamtypes.APIStream) {
	err := stream.ExecuteFlow(apiStream)
	require.NoError(t, err, "Failed to execute flow")
}

func getExecutionContext(stream *Stream, apiStream *streamtypes.APIStream) streamtypes.LunarContextI {
	return stream.filterTree.GetFlow(apiStream).GetExecutionContext()
}
