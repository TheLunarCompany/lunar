package streams

import (
	"errors"
	"fmt"
	lunar_messages "lunar/engine/messages"
	stream_config "lunar/engine/streams/config"
	test_processors "lunar/engine/streams/flow/test-processors"
	internal_types "lunar/engine/streams/internal-types"
	lunar_context "lunar/engine/streams/lunar-context"
	"lunar/engine/streams/processors"
	filter_processor "lunar/engine/streams/processors/filter-processor"
	public_types "lunar/engine/streams/public-types"
	stream_types "lunar/engine/streams/types"
	"lunar/engine/utils/environment"
	context_manager "lunar/toolkit-core/context-manager"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

var sharedState = lunar_context.NewMemoryState[[]byte]()

func TestMain(m *testing.M) {
	prevVal := environment.SetProcessorsDirectory(filepath.Join("flow", "test-processors"))

	context_manager.Get().SetMockClock()

	// Run the tests
	code := m.Run()

	// Clean up if necessary
	environment.SetProcessorsDirectory(prevVal)

	// Exit with the code from the tests
	os.Exit(code)
}

func setFlowRepDirectory(path string) string {
	return environment.SetStreamsFlowsDirectory(path)
}

func revertFlowRepDirectory(path string) {
	environment.SetStreamsFlowsDirectory(path)
}

func TestNewStream(t *testing.T) {
	stream, err := NewStream()
	require.NoError(t, err, "Failed to create stream")
	require.NotNil(t, stream, "stream is nil")
	require.NotNil(t, stream.apiStreams, "APIStreams is nil")
	require.NotNil(t, stream.filterTree, "filterTree is nil")
}

func TestRequestBodyFromResponseStream(t *testing.T) {
	reqBody := "request body"
	resBody := "response body"
	seqID := "1234"

	apiStreamReq := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeRequest, sharedState)
	apiStreamReq.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:     "GET",
		Scheme:     "https",
		SequenceID: seqID,
		URL:        "maps.googleapis.com/maps/api/geocode/json",
		Headers:    map[string]string{},
		RawBody:    []byte(reqBody),
	}))
	apiStreamReq.StoreRequest()
	apiStreamRes := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeResponse, sharedState)
	apiStreamRes.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Method:     "GET",
		SequenceID: seqID,
		URL:        "maps.googleapis.com/maps/api/geocode/json",
		Headers:    map[string]string{},
		RawBody:    []byte(resBody),
	}))
	req := apiStreamRes.GetRequest()
	fmt.Printf("Request body: %+v\v", req)
	fmt.Printf("Request: %s\v", req.GetBody())
	require.Equal(t, reqBody, apiStreamRes.GetRequest().GetBody(), "Request body is not correct")
	require.Equal(t, resBody, apiStreamRes.GetResponse().GetBody(), "Response body is not correct")
}

func TestExecuteFlows(t *testing.T) {
	procMng := createTestProcessorManager(
		t,
		[]string{
			"removePII",
			"readCache",
			"checkLimit",
			"generateResponse",
			"globalStream",
			"writeCache",
			"LogAPM",
			"readXXX",
			"writeXXX",
		},
	)
	stream, err := NewStream()
	require.NoError(t, err, "Failed to create stream")
	stream.processorsManager = procMng
	flowReps := createFlowRepresentation(t, "2-flows-test*")

	defer revertFlowRepDirectory(setFlowRepDirectory(filepath.Join("flow", "test-cases", "2-flows-test-case")))

	err = stream.Initialize()
	require.NoError(t, err, "Failed to create flows")
	err = stream.createFlows(flowReps)
	require.NoError(t, err, "Failed to create flows")

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeRequest, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "maps.googleapis.com/maps/api/geocode/json",
		Headers: map[string]string{},
	}))

	flowActions := &stream_config.StreamActions{
		Request:  &stream_config.RequestStream{},
		Response: &stream_config.ResponseStream{},
	}
	err = stream.ExecuteFlow(apiStream, flowActions)
	require.NoError(t, err, "Failed to execute flow")

	apiStream.SetType(public_types.StreamTypeResponse)
	err = stream.ExecuteFlow(apiStream, flowActions)
	require.NoError(t, err, "Failed to execute flow")

	// Test for 3 flows
	procMng = createTestProcessorManager(
		t,
		[]string{
			"removePII",
			"readCache",
			"checkLimit",
			"generateResponse",
			"globalStream",
			"writeCache",
			"LogAPM",
			"readXXX",
			"writeXXX",
		},
	)
	stream, err = NewStream()
	require.NoError(t, err, "Failed to create stream")
	stream.processorsManager = procMng

	flowReps = createFlowRepresentation(t, "3-flows*")
	setFlowRepDirectory(filepath.Join("flow", "test-cases", "3-flows-test-case"))
	err = stream.Initialize()
	require.NoError(t, err, "Failed to create flows")
	err = stream.createFlows(flowReps)
	require.NoError(t, err, "Failed to create flows")

	apiStream = stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeRequest, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "www.whatever.com/blabla",
		Headers: map[string]string{},
	}))

	err = stream.ExecuteFlow(apiStream, flowActions)
	require.NoError(t, err, "Failed to execute flow")
}

func TestCreateFlows(t *testing.T) {
	procMng := createTestProcessorManager(
		t,
		[]string{
			"removePII",
			"readCache",
			"checkLimit",
			"generateResponse",
			"globalStream",
			"writeCache",
			"LogAPM",
			"readXXX",
			"writeXXX",
		},
	)
	stream, err := NewStream()
	require.NoError(t, err, "Failed to create stream")

	stream.processorsManager = procMng
	flowReps := createFlowRepresentation(t, "2-flows-test*")
	defer revertFlowRepDirectory(setFlowRepDirectory(filepath.Join("flow", "test-cases", "2-flows-test-case")))
	err = stream.Initialize()
	require.NoError(t, err, "Failed to create flows")
	err = stream.createFlows(flowReps)
	require.NoError(t, err, "Failed to create flows")

	procMng = createTestProcessorManager(
		t,
		[]string{
			"removePII",
			"readCache",
			"checkLimit",
			"generateResponse",
			"globalStream",
			"writeCache",
			"LogAPM",
			"readXXX",
			"writeXXX",
		},
	)
	stream, err = NewStream()
	require.NoError(t, err, "Failed to create stream")

	stream.processorsManager = procMng
	flowReps = createFlowRepresentation(t, "3-flows*")
	setFlowRepDirectory(filepath.Join("flow", "test-cases", "3-flows-test-case"))
	err = stream.Initialize()
	require.NoError(t, err, "Failed to create flows")
	err = stream.createFlows(flowReps)
	require.NoError(t, err, "Failed to create flows")
}

func TestCreateFlowsWithSameProcessorsName(t *testing.T) {
	procMng := createTestProcessorManager(
		t,
		[]string{
			"removePII",
			"readCache",
			"checkLimit",
			"generateResponse",
			"globalStream",
			"writeCache",
			"LogAPM",
			"readCache",
			"writeCache",
		},
	)
	stream, err := NewStream()
	require.NoError(t, err, "Failed to create stream")

	stream.processorsManager = procMng
	flowReps := createFlowRepresentation(t, "2-flows-same-processor-key-test-case")
	defer revertFlowRepDirectory(
		setFlowRepDirectory(filepath.Join("flow", "test-cases", "2-flows-same-processor-key-test-case")),
	)
	err = stream.Initialize()
	require.NoError(t, err, "Failed to create flows")
	err = stream.createFlows(flowReps)
	require.NoError(t, err, "Failed to create flows")
}

func TestEarlyResponseFlow(t *testing.T) {
	procMng := createTestProcessorManagerWithFactories(
		t,
		[]string{"readCache", "writeCache", "generateResponse", "LogAPM"},
		test_processors.NewMockProcessorUsingCache,
		test_processors.NewMockProcessor,
		test_processors.NewMockGenerateResponseProcessor,
		test_processors.NewMockProcessor,
	)
	stream, err := NewStream()
	require.NoError(t, err, "Failed to create stream")
	stream.processorsManager = procMng

	defer revertFlowRepDirectory(setFlowRepDirectory(filepath.Join("flow", "test-cases", "early-response-test-case")))
	err = stream.Initialize()
	require.NoError(t, err, "Failed to create flows")
	require.NoError(t, err, "Failed to create flows")

	contextManager := lunar_context.NewContextManager()
	globalContext := contextManager.GetGlobalContext()

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeRequest, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Method: "GET",
		Status: 200,
		URL:    "maps.googleapis.com/maps/api/geocode/json",
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "maps.googleapis.com/maps/api/geocode/json",
		Headers: map[string]string{},
	}))
	flowActions := &stream_config.StreamActions{
		Request:  &stream_config.RequestStream{},
		Response: &stream_config.ResponseStream{},
	}

	// simulate early response
	err = globalContext.Set(test_processors.GlobalKeyExecutionOrder, []string{})
	require.NoError(t, err, "Failed to set global context value")
	err = globalContext.Set(test_processors.GlobalKeyCacheHit, true)
	require.NoError(t, err, "Failed to set global context value")

	err = stream.ExecuteFlow(apiStream, flowActions)
	require.NoError(t, err, "Failed to execute flow")

	execOrder, err := globalContext.Get(test_processors.GlobalKeyExecutionOrder)
	require.NoError(t, err, "Failed to get global context value")
	require.Equal(t, []string{"readCache", "generateResponse", "LogAPM"}, execOrder, "Execution order is not correct")

	// simulate regular execution
	apiStream.SetType(public_types.StreamTypeRequest)
	err = globalContext.Set(test_processors.GlobalKeyExecutionOrder, []string{})
	require.NoError(t, err, "Failed to set global context value")
	err = globalContext.Set(test_processors.GlobalKeyCacheHit, false)
	require.NoError(t, err, "Failed to set global context value")

	err = stream.ExecuteFlow(apiStream, flowActions)
	require.NoError(t, err, "Failed to execute flow")

	execOrder, err = globalContext.Get(test_processors.GlobalKeyExecutionOrder)
	require.NoError(t, err, "Failed to get global context value")
	require.Equal(t, []string{"readCache"}, execOrder, "Execution order is not correct")

	// simulate API provider response
	apiStream.SetType(public_types.StreamTypeResponse)
	err = globalContext.Set(test_processors.GlobalKeyExecutionOrder, []string{})
	require.NoError(t, err, "Failed to set global context value")

	err = stream.ExecuteFlow(apiStream, flowActions)
	require.NoError(t, err, "Failed to execute flow")

	execOrder, err = globalContext.Get(test_processors.GlobalKeyExecutionOrder)
	require.NoError(t, err, "Failed to get global context value")
	require.Equal(t, []string{"writeCache"}, execOrder, "Execution order is not correct")
}

func TestEarlyResponseFromAnotherFlow(t *testing.T) {
	procMng := createTestProcessorManager(
		t,
		[]string{
			"removePII",
			"readCache",
			"checkLimit",
			"generateResponse",
			"globalStream",
			"writeCache",
			"LogAPM",
			"readCache",
			"writeCache",
		},
	)

	stream, err := NewStream()
	require.NoError(t, err, "Failed to create stream")
	stream.processorsManager = procMng

	defer revertFlowRepDirectory(setFlowRepDirectory(filepath.Join("flow", "test-cases", "cross-flow-processor-use")))
	err = stream.Initialize()
	require.NoError(t, err, "Failed to create flows")

	contextManager := lunar_context.NewContextManager()
	globalContext := contextManager.GetGlobalContext()

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeRequest, sharedState)
	apiStream.SetResponse(stream_types.NewResponse(lunar_messages.OnResponse{
		Status: 200,
		URL:    "maps.googleapis.com/maps/api/geocode/json",
	}))
	apiStream.SetRequest(stream_types.NewRequest(lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "maps.googleapis.com/maps/api/geocode/json",
		Headers: map[string]string{},
	}))
	flowActions := &stream_config.StreamActions{
		Request:  &stream_config.RequestStream{},
		Response: &stream_config.ResponseStream{},
	}

	// simulate early response
	err = globalContext.Set(test_processors.GlobalKeyExecutionOrder, []string{})
	require.NoError(t, err, "Failed to set global context value")
	err = globalContext.Set(test_processors.GlobalKeyCacheHit, true)
	require.NoError(t, err, "Failed to set global context value")

	err = stream.ExecuteFlow(apiStream, flowActions)
	require.NoError(t, err, "Failed to execute flow")

	execOrder, err := globalContext.Get(test_processors.GlobalKeyExecutionOrder)
	require.NoError(t, err, "Failed to get global context value")
	require.Equal(t, []string{"readCache"}, execOrder, "Execution order is not correct")
}

func TestFilterProcessorFlow(t *testing.T) {
	procMng := createTestProcessorManagerWithFactories(t, []string{"Filter", "generateResponse", "LogAPM"},
		filter_processor.NewProcessor,
		test_processors.NewMockGenerateResponseProcessor,
		test_processors.NewMockProcessor,
	)

	stream, err := NewStream()
	require.NoError(t, err, "Failed to create stream")
	stream.processorsManager = procMng

	_ = createFlowRepresentation(t, "filter*")
	defer revertFlowRepDirectory(setFlowRepDirectory(filepath.Join("flow", "test-cases", "filter-processor-test-case")))
	err = stream.Initialize()
	require.NoError(t, err, "Failed to create flows")
	require.NoError(t, err, "Failed to create flows")

	contextManager := lunar_context.NewContextManager()
	globalContext := contextManager.GetGlobalContext()

	apiStream := stream_types.NewAPIStream("APIStreamName", public_types.StreamTypeRequest, sharedState)
	request := lunar_messages.OnRequest{
		Method:  "GET",
		Scheme:  "https",
		URL:     "maps.googleapis.com/maps/api/geocode/json",
		Headers: map[string]string{"x-group": "production"},
	}
	apiStream.SetRequest(stream_types.NewRequest(request))

	// execution for production environment
	err = globalContext.Set(test_processors.GlobalKeyExecutionOrder, []string{})
	require.NoError(t, err, "Failed to set global context value")

	flowActions := &stream_config.StreamActions{
		Request:  &stream_config.RequestStream{},
		Response: &stream_config.ResponseStream{},
	}

	err = stream.ExecuteFlow(apiStream, flowActions)
	require.NoError(t, err, "Failed to execute flow")

	execOrder, err := globalContext.Get(test_processors.GlobalKeyExecutionOrder)
	require.NoError(t, err, "Failed to get global context value")
	require.Equal(t, []string{"LogAPM"}, execOrder, "Execution order is not correct")

	// execution for staging environment
	request.Headers["x-group"] = "staging"
	apiStream.SetRequest(stream_types.NewRequest(request))

	err = globalContext.Set(test_processors.GlobalKeyExecutionOrder, []string{})
	require.NoError(t, err, "Failed to set global context value")

	err = stream.ExecuteFlow(apiStream, flowActions)
	require.NoError(t, err, "Failed to execute flow")

	execOrder, err = globalContext.Get(test_processors.GlobalKeyExecutionOrder)
	require.NoError(t, err, "Failed to get global context value")
	require.Equal(t, []string{"GenerateResponseTooManyRequests"}, execOrder, "Execution order is not correct")

	// execution for development environment
	request.Headers["x-group"] = "development"
	apiStream.SetRequest(stream_types.NewRequest(request))

	err = globalContext.Set(test_processors.GlobalKeyExecutionOrder, []string{})
	require.NoError(t, err, "Failed to set global context value")

	err = stream.ExecuteFlow(apiStream, flowActions)
	require.NoError(t, err, "Failed to execute flow")

	execOrder, err = globalContext.Get(test_processors.GlobalKeyExecutionOrder)
	require.NoError(t, err, "Failed to get global context value")

	require.Equal(t, []string{"LogAPM"}, execOrder, "Execution order is not correct")
}

func TestMeasureFlowExecutionTime(t *testing.T) {
	metrics := newFlowMetricsData()

	for i := 0; i < 5; i++ {
		err := metrics.measureFlowExecutionTime("test flow", func() error {
			time.Sleep(50 * time.Millisecond) // Simulate some work
			return nil
		})
		require.NoError(t, err)
	}

	avgTimeData := metrics.getAvgFlowExecutionTime()
	require.Greater(t, avgTimeData.AvgFlowExecutionTime["test flow"], 0.0)

	// Ensure that the average is within the expected range
	// Allowing some delta (±10ms) due to possible variations in execution time
	require.InDelta(t, 50, avgTimeData.AvgFlowExecutionTime["test flow"], 10)

	// Call the measured function with an error to check that it doesn't affect the average
	err := metrics.measureFlowExecutionTime("test flow", func() error {
		return errors.New("test error")
	})
	require.Error(t, err)
	require.Equal(t, "test error", err.Error())

	// average execution time should be still the same after the error
	avgTimeAfterError := metrics.getAvgFlowExecutionTime()
	require.Equal(t, avgTimeData.AvgFlowExecutionTime["test flow"], avgTimeAfterError.AvgFlowExecutionTime["test flow"])
}

func createTestProcessorManager(t *testing.T, processorNames []string) *processors.ProcessorManager {
	return createTestProcessorManagerWithFactories(t, processorNames, test_processors.NewMockProcessor)
}

func createTestProcessorManagerWithFactories(
	t *testing.T,
	processorNames []string,
	factories ...processors.ProcessorFactory,
) *processors.ProcessorManager {
	processorMng := processors.NewProcessorManager(nil)
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

func createFlowRepresentation(t *testing.T, testCase string) map[string]internal_types.FlowRepI {
	pattern := filepath.Join("flow", "test-cases", testCase, "*.yaml")
	files, fileErr := filepath.Glob(pattern)
	require.NoError(t, fileErr, "Failed to find YAML files")

	flowReps := make(map[string]internal_types.FlowRepI)
	for _, file := range files {
		t.Run(filepath.Base(file), func(t *testing.T) {
			flowRep, err := stream_config.ReadStreamFlowConfig(file)
			require.NoError(t, err, "Failed to read YAML file")

			// TODO: We should do it more strict that we load the processor keys
			for key, proc := range flowRep.Processors {
				proc.Key = key
				flowRep.Processors[key] = proc
			}
			flowReps[flowRep.Name] = flowRep
		})
	}
	return flowReps
}
