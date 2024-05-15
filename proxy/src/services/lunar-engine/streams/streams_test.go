package streams

import (
	streamconfig "lunar/engine/streams/config"
	streamtypes "lunar/engine/streams/types"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

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
	stream := NewStream()
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
	flowReps = createFlowRepresentation(t, "3-flows*")
	err = stream.createFlows(flowReps)
	require.NoError(t, err, "Failed to create flows")
	apiStream.Request.URL = "www.whatever.com/blabla"
	apiStream.Type = streamtypes.StreamTypeRequest

	err = stream.ExecuteFlow(apiStream)
	require.NoError(t, err, "Failed to execute flow")
}

func TestCreateFlows(t *testing.T) {
	stream := NewStream()
	flowReps := createFlowRepresentation(t, "2-flows*")

	err := stream.createFlows(flowReps)
	require.NoError(t, err, "Failed to create flows")

	stream = NewStream()
	flowReps = createFlowRepresentation(t, "3-flows*")
	err = stream.createFlows(flowReps)
	require.NoError(t, err, "Failed to create flows")
}
