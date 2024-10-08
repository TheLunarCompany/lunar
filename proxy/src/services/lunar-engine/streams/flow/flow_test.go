package streamflow

import (
	"fmt"
	"log"
	"lunar/engine/messages"
	streamconfig "lunar/engine/streams/config"
	streamfilter "lunar/engine/streams/filter"
	internaltypes "lunar/engine/streams/internal-types"
	"lunar/engine/streams/processors"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/streams/resources"
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils/environment"
	"os"
	"path/filepath"
	"testing"

	testprocessors "lunar/engine/streams/flow/test-processors"

	"github.com/stretchr/testify/require"
)

func TestMain(m *testing.M) {
	prevVal := environment.SetProcessorsDirectory("test-processors")

	// Run the tests
	code := m.Run()

	// Clean up if necessary
	environment.SetProcessorsDirectory(prevVal)

	// Exit with the code from the tests
	os.Exit(code)
}

func createTestProcessorManager(
	t *testing.T,
	processorNames []string,
) *processors.ProcessorManager {
	processorMng := processors.NewProcessorManager(nil)
	for _, procName := range processorNames {
		log.Default().Printf("Setting factory for processor %s", procName)
		processorMng.SetFactory(procName, testprocessors.NewMockProcessor)
	}

	err := processorMng.Init()
	require.NoError(t, err)

	return processorMng
}

func newTestFlow(t *testing.T, processorsCount int) *Flow {
	flowRep := &streamconfig.FlowRepresentation{
		Name: "testFlow",
		Filter: &streamconfig.Filter{
			Name: "testFilter",
			URL:  "*",
		},
		Processors: make(map[string]*streamconfig.Processor),
	}

	var processorNames []string
	for i := 1; i <= processorsCount; i++ {
		name := fmt.Sprintf("processor%d", i)
		flowRep.Processors[name] = &streamconfig.Processor{
			Processor: name,
		}
		processorNames = append(processorNames, name)
	}

	processorMng := createTestProcessorManager(t, processorNames)

	nodeBuilder := newGraphNodeBuilder(map[string]internaltypes.FlowRepI{
		flowRep.Name: flowRep,
	}, processorMng)

	return NewFlow(nodeBuilder, flowRep, nil)
}

func newTestAPIStream(url string) publictypes.APIStreamI {
	apiStream := streamtypes.NewAPIStream("APIStreamName", publictypes.StreamTypeRequest)
	apiStream.SetRequest(streamtypes.NewRequest(messages.OnRequest{
		Method:  "GET",
		URL:     url,
		Headers: map[string]string{},
	}))

	apiStream.SetContext(streamtypes.NewLunarContext(streamtypes.NewContext()))
	apiStream.SetResponse(streamtypes.NewResponse(messages.OnResponse{
		Status: 200,
	}))

	return apiStream
}

func addProcessors(t *testing.T,
	flowDirection *FlowDirection,
	namePrefix string,
	count int,
) {
	addProcessorsWithDetails(t, flowDirection, namePrefix, count)
}

func addProcessorsWithDetails(
	t *testing.T,
	flowDirection *FlowDirection,
	namePrefix string,
	count int,
) {
	for i := 1; i <= count; i++ {
		name := fmt.Sprintf("%s%d", namePrefix, i)
		_, err := flowDirection.getOrCreateNode(flowDirection.flowName, name)
		require.NoError(t, err)
	}
}

func TestGetNode(t *testing.T) {
	flowGraph := newTestFlow(t, 1)

	addProcessors(t, flowGraph.request, "processor", 1)

	node, err := flowGraph.request.GetNode("processor1")
	require.NoError(t, err)
	require.NotNil(t, node)

	_, err = flowGraph.request.GetNode("nonExistentNode")
	require.Error(t, err)
}

func TestBuildFlows(t *testing.T) {
	globalStreamRefStart := &streamconfig.StreamRef{Name: publictypes.GlobalStream, At: "start"}
	globalStreamRefEnd := &streamconfig.StreamRef{Name: publictypes.GlobalStream, At: "end"}
	processorRef1 := &streamconfig.ProcessorRef{Name: "processor1"}
	processorRef1Condition := &streamconfig.ProcessorRef{Name: "processor1", Condition: "condition"}
	processorRef2 := &streamconfig.ProcessorRef{Name: "processor2"}
	processorRef2Condition := &streamconfig.ProcessorRef{Name: "processor2", Condition: "condition"}
	processorRef2Condition2 := &streamconfig.ProcessorRef{
		Name:      "processor2",
		Condition: "condition2",
	}
	processorRef3 := &streamconfig.ProcessorRef{Name: "processor3"}
	processorRef4 := &streamconfig.ProcessorRef{Name: "processor4"}
	processorRef5 := &streamconfig.ProcessorRef{Name: "processor5"}
	processorRef6 := &streamconfig.ProcessorRef{Name: "processor6"}
	filter := streamconfig.Filter{Name: "filter1", URL: "example.com"}
	processorMng := createTestProcessorManager(
		t,
		[]string{
			"processor1",
			"processor2",
			"processor3",
			"processor4",
			"processor5",
			"processor6",
		},
	)

	testCases := []struct {
		name       string
		flowReps   map[string]internaltypes.FlowRepI
		validateFn func(t *testing.T,
			graphs map[string]*Flow,
			requestEntryPoint, responseEntryPoint internaltypes.EntryPointI,
		)
		expectErr      bool
		expectedErrMsg string
	}{
		{
			name: "Valid single graph",
			flowReps: map[string]internaltypes.FlowRepI{
				"GraphWithEntryPoints": &streamconfig.FlowRepresentation{
					Filter: &filter,
					Name:   "GraphWithEntryPoints",
					Processors: map[string]*streamconfig.Processor{
						"processor1": {Processor: "processor1"},
					},
					Flow: streamconfig.Flow{
						Request: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{Stream: globalStreamRefStart},
								To:   &streamconfig.Connection{Processor: processorRef1},
							},
							{
								From: &streamconfig.Connection{Processor: processorRef1},
								To:   &streamconfig.Connection{Stream: globalStreamRefEnd},
							},
						},
						Response: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{Stream: globalStreamRefStart},
								To:   &streamconfig.Connection{Processor: processorRef1},
							},
							{
								From: &streamconfig.Connection{Processor: processorRef1},
								To:   &streamconfig.Connection{Stream: globalStreamRefEnd},
							},
						},
					},
				},
			},
			expectErr: false,
		},
		{
			name: "Graph with no direction defined",
			flowReps: map[string]internaltypes.FlowRepI{
				"Graph1": &streamconfig.FlowRepresentation{
					Filter: &filter,
					Name:   "Graph1",
					Processors: map[string]*streamconfig.Processor{
						"processor1": {Processor: "processor1", Parameters: nil},
					},
					Flow: streamconfig.Flow{},
				},
			},
			expectErr: true,
		},
		{
			name: "Graph with single direction defined",
			flowReps: map[string]internaltypes.FlowRepI{
				"Graph1": &streamconfig.FlowRepresentation{
					Filter: &filter,
					Name:   "Graph1",
					Processors: map[string]*streamconfig.Processor{
						"processor1": {Processor: "processor1", Parameters: nil},
					},
					Flow: streamconfig.Flow{
						Request: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{Stream: globalStreamRefStart},
								To:   &streamconfig.Connection{Processor: processorRef1},
							},
							{
								From: &streamconfig.Connection{Processor: processorRef1},
								To:   &streamconfig.Connection{Stream: globalStreamRefEnd},
							},
						},
					},
				},
			},
			expectErr: false,
		},
		{
			// The following test case ensures that a flow such as below is valid - although we get to 5 twice.
			// +---+     	+---+     condition      +---+      +---+
			// | 1 | ---->| 2 | ------------------>| 3 | ---->| 5 |
			// +---+		 	+---+                    +---+      +---+
			//					 		|                                   ^
			//					 		|                                   |
			//					 condition2                             |
			//					 		|                                   |
			//					 		v                                   |
			//					 	+---+                                 |
			//					 	| 4 | ---------------------------------
			//					 	+---+
			name:      "Valid - revisiting nodes without circular connections",
			expectErr: false,
			flowReps: map[string]internaltypes.FlowRepI{
				"revisitingNodes": &streamconfig.FlowRepresentation{
					Name:   "revisitingNodes",
					Filter: &filter,
					Processors: map[string]*streamconfig.Processor{
						"processor1": {Processor: "processor1"},
						"processor2": {Processor: "processor2"},
						"processor3": {Processor: "processor3"},
						"processor4": {Processor: "processor4"},
						"processor5": {Processor: "processor5"},
					},
					Flow: streamconfig.Flow{
						Request: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{
									Stream: globalStreamRefStart,
								},
								To: &streamconfig.Connection{
									Processor: processorRef1,
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: processorRef1,
								},
								To: &streamconfig.Connection{
									Processor: processorRef2,
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: processorRef2Condition,
								},
								To: &streamconfig.Connection{
									Processor: processorRef3,
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: processorRef2Condition2,
								},
								To: &streamconfig.Connection{
									Processor: processorRef4,
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: processorRef4,
								},
								To: &streamconfig.Connection{
									Processor: processorRef5,
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: processorRef3,
								},
								To: &streamconfig.Connection{
									Processor: processorRef5,
								},
							},

							{
								From: &streamconfig.Connection{Processor: processorRef5},
								To:   &streamconfig.Connection{Stream: globalStreamRefEnd},
							},
						},
					},
				},
			},
		},
		{
			// The following test case ensures that a flow such as below is invalid - because of cyclicism.
			// +---+				+---+     condition      +---+      +---+
			// | 1 | ------>| 2 | ------------------>| 3 | ---->| 5 |
			// +---+				+---+ <----------        +---+      +---+
			//						 		|             |
			//						 		|             |
			//						 condition2       |
			//						 		|             |
			//						 		v             |
			//						 	+---+        +---+
			//						 	| 4 | -------| 6 |
			//						 	+---+				 +---+
			// It is a little more elaborate then other tests in this file since it is not an A<=>B circular connection.
			name:           "Invalid - revisiting nodes without circular connections",
			expectErr:      true,
			expectedErrMsg: "circular connection detected",
			flowReps: map[string]internaltypes.FlowRepI{
				"invalidCyclicNodes": &streamconfig.FlowRepresentation{
					Name:   "invalidCyclicNodes",
					Filter: &filter,
					Processors: map[string]*streamconfig.Processor{
						"processor1": {Processor: "processor1"},
						"processor2": {Processor: "processor2"},
						"processor3": {Processor: "processor3"},
						"processor4": {Processor: "processor4"},
						"processor5": {Processor: "processor5"},
						"processor6": {Processor: "processor6"},
					},
					Flow: streamconfig.Flow{
						Request: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{
									Stream: globalStreamRefStart,
								},
								To: &streamconfig.Connection{
									Processor: processorRef1,
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: processorRef1,
								},
								To: &streamconfig.Connection{
									Processor: processorRef2,
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: processorRef2Condition,
								},
								To: &streamconfig.Connection{
									Processor: processorRef3,
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: processorRef2Condition2,
								},
								To: &streamconfig.Connection{
									Processor: processorRef4,
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: processorRef3,
								},
								To: &streamconfig.Connection{
									Processor: processorRef5,
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: processorRef4,
								},
								To: &streamconfig.Connection{
									Processor: processorRef6,
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: processorRef6,
								},
								To: &streamconfig.Connection{
									Processor: processorRef2,
								},
							},
						},
					},
				},
			},
		},
		{
			name: "Valid Multiple Graphs Merging",
			flowReps: map[string]internaltypes.FlowRepI{
				// Graph 1 with a request entry point
				"Graph1": &streamconfig.FlowRepresentation{
					Filter: &filter,
					Name:   "Graph1",
					Processors: map[string]*streamconfig.Processor{
						"processor1": {Processor: "processor1"},
						"processor2": {Processor: "processor2"},
					},
					Flow: streamconfig.Flow{
						Request: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{Stream: globalStreamRefStart},
								To: &streamconfig.Connection{
									Processor: &streamconfig.ProcessorRef{Name: "processor1"},
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: &streamconfig.ProcessorRef{Name: "processor1"},
								},
								To: &streamconfig.Connection{Stream: globalStreamRefEnd},
							},
						},
						Response: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{Stream: globalStreamRefStart},
								To:   &streamconfig.Connection{Processor: processorRef2},
							},
							{
								From: &streamconfig.Connection{Processor: processorRef2},
								To:   &streamconfig.Connection{Stream: globalStreamRefEnd},
							},
						},
					},
				},
				// Graph 2 intended to be connected at the start of Graph 1
				"Graph2": &streamconfig.FlowRepresentation{
					Filter: &filter,
					Name:   "Graph2",
					Processors: map[string]*streamconfig.Processor{
						"processor3": {Processor: "processor3"},
						"processor4": {Processor: "processor4"},
					},
					Flow: streamconfig.Flow{
						Request: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{
									Flow: &streamconfig.FlowRef{Name: "Graph1", At: "end"},
								},
								To: &streamconfig.Connection{
									Processor: &streamconfig.ProcessorRef{Name: "processor3"},
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: &streamconfig.ProcessorRef{Name: "processor3"},
								},
								To: &streamconfig.Connection{
									Processor: &streamconfig.ProcessorRef{Name: "processor4"},
								},
							},
							{
								From: &streamconfig.Connection{
									Processor: &streamconfig.ProcessorRef{Name: "processor4"},
								},
								To: &streamconfig.Connection{Stream: globalStreamRefEnd},
							},
						},
						Response: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{Stream: globalStreamRefStart},
								To: &streamconfig.Connection{
									Processor: &streamconfig.ProcessorRef{Name: "processor3"},
								},
							},
							{ // Connection indicating Graph2 flows into Graph1
								From: &streamconfig.Connection{
									Processor: &streamconfig.ProcessorRef{Name: "processor3"},
								},
								To: &streamconfig.Connection{
									Flow: &streamconfig.FlowRef{Name: "Graph1", At: "start"},
								},
							},
						},
					},
				},
			},
			expectErr: false,
			validateFn: func(t *testing.T, graphs map[string]*Flow, requestEntryPoint, _ internaltypes.EntryPointI) {
				// Validate that the TotalFlowGraph contains nodes from both Graph1 and Graph2
				require.NotNil(t, graphs["Graph1"], "Graph1 should be part of the total flow graph")
				require.NotNil(t, graphs["Graph2"], "Graph2 should be part of the total flow graph")

				// Validate correct configuration of entry points for the total flow.
				require.NotNil(
					t,
					requestEntryPoint,
					"The total flow graph should have a valid request entry point",
				)
				require.Equal(t, publictypes.GlobalStream, requestEntryPoint.GetStream().GetName())

				// Validate integrity of connections between Graph1 and Graph2.
				graph2RequestRoot := graphs["Graph2"].request.root
				require.NotNil(t, graph2RequestRoot, "Graph2 should have response entry point")
				require.Equal(t, "processor3", graph2RequestRoot.GetNode().GetProcessor().GetName())
				require.Equal(t, graphs["Graph1"].GetName(), graph2RequestRoot.GetFlow().GetName())
				require.Equal(t, "end", graph2RequestRoot.GetFlow().GetAt())
				require.Equal(t, "Graph2", graph2RequestRoot.GetNode().GetFlowGraphName())

				graph2ResponseRoot := graphs["Graph2"].response.root
				require.NotNil(t, graph2ResponseRoot, "Graph2 should have response entry point")

				require.Equal(
					t,
					"processor3",
					graph2ResponseRoot.GetNode().GetProcessor().GetName(),
				)
				require.Equal(
					t,
					globalStreamRefStart.Name,
					graph2ResponseRoot.GetStream().GetName(),
				)
				require.Equal(t, "start", graph2ResponseRoot.GetStream().GetAt())
			},
		},
		{
			name:           "Invalid - Circular Processor Connections",
			expectErr:      true,
			expectedErrMsg: "circular connection detected",
			flowReps: map[string]internaltypes.FlowRepI{
				"circularProcessorConnections": &streamconfig.FlowRepresentation{
					Name: "circularProcessorConnections",
					Processors: map[string]*streamconfig.Processor{
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
								To:   &streamconfig.Connection{Processor: processorRef1},
							},
						},
					},
				},
			},
		},
		{
			name:           "Invalid - Circular Processor Connections with condition",
			expectErr:      true,
			expectedErrMsg: "circular connection detected",
			flowReps: map[string]internaltypes.FlowRepI{
				"circularProcessorConnections": &streamconfig.FlowRepresentation{
					Name: "circularProcessorConnections",
					Processors: map[string]*streamconfig.Processor{
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
								From: &streamconfig.Connection{Processor: processorRef1Condition},
								To:   &streamconfig.Connection{Processor: processorRef2},
							},
							{
								From: &streamconfig.Connection{Processor: processorRef2Condition},
								To:   &streamconfig.Connection{Processor: processorRef1},
							},
						},
					},
				},
			},
		},
		{
			name:           "Invalid - circular processor connections, with different conditions",
			expectErr:      true,
			expectedErrMsg: "circular connection detected",
			flowReps: map[string]internaltypes.FlowRepI{
				"circularProcessorConnections": &streamconfig.FlowRepresentation{
					Name: "circularProcessorConnections",
					Processors: map[string]*streamconfig.Processor{
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
								From: &streamconfig.Connection{Processor: processorRef1Condition},
								To:   &streamconfig.Connection{Processor: processorRef2},
							},
							{
								From: &streamconfig.Connection{Processor: processorRef2Condition2},
								To:   &streamconfig.Connection{Processor: processorRef1},
							},
						},
					},
				},
			},
		},
		{
			name:      "Invalid - Processor Refers to Nonexistent Target",
			expectErr: true,
			flowReps: map[string]internaltypes.FlowRepI{
				"invalidProcessorRef": &streamconfig.FlowRepresentation{
					Name: "invalidProcessorRef",
					Processors: map[string]*streamconfig.Processor{
						"processor1": {Processor: "processor1"},
					},
					Flow: streamconfig.Flow{
						Request: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{Processor: processorRef1},
								To: &streamconfig.Connection{
									Processor: &streamconfig.ProcessorRef{
										Name: "nonexistent_processor",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name:      "Invalid - Reference to nonexistent flow",
			expectErr: true,
			flowReps: map[string]internaltypes.FlowRepI{
				"invalidFlowRef": &streamconfig.FlowRepresentation{
					Name: "invalidFlowRef",
					Flow: streamconfig.Flow{
						Request: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{
									Flow: &streamconfig.FlowRef{
										Name: "nonexistent_flow",
										At:   "end",
									},
								},
								To: &streamconfig.Connection{Processor: processorRef1},
							},
						},
					},
				},
			},
		},
		{
			name:      "Invalid - Stream Refers to Nonexistent Processor",
			expectErr: true,
			flowReps: map[string]internaltypes.FlowRepI{
				"invalidStreamRef": &streamconfig.FlowRepresentation{
					Name: "invalidStreamRef",
					Flow: streamconfig.Flow{
						Request: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{
									Stream: &streamconfig.StreamRef{Name: publictypes.GlobalStream},
								},
								To: &streamconfig.Connection{
									Processor: &streamconfig.ProcessorRef{
										Name: "nonexistent_processor",
									},
								},
							},
						},
					},
				},
			},
		},
		{
			name:      "Invalid - No Valid Root",
			expectErr: true,
			flowReps: map[string]internaltypes.FlowRepI{
				"No valid root flow": &streamconfig.FlowRepresentation{
					Filter: &filter,
					Name:   "No valid root flow",
					Processors: map[string]*streamconfig.Processor{
						"processor1": {Processor: "processor1"},
					},
					Flow: streamconfig.Flow{
						Request: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{Processor: processorRef1},
								To:   &streamconfig.Connection{Stream: globalStreamRefEnd},
							},
						},
						Response: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{Stream: globalStreamRefStart},
								To:   &streamconfig.Connection{Processor: processorRef1},
							},
						},
					},
				},
			},
		},
		{
			name:      "Response flow with no root",
			expectErr: false,
			flowReps: map[string]internaltypes.FlowRepI{
				"No root for response flow flow": &streamconfig.FlowRepresentation{
					Filter: &filter,
					Name:   "No root for response flow flow",
					Processors: map[string]*streamconfig.Processor{
						"processor1": {Processor: "processor1"},
					},
					Flow: streamconfig.Flow{
						Request: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{Stream: globalStreamRefStart},
								To:   &streamconfig.Connection{Processor: processorRef1},
							},
							{
								From: &streamconfig.Connection{Processor: processorRef1},
								To:   &streamconfig.Connection{Stream: globalStreamRefEnd},
							},
						},
						Response: []*streamconfig.FlowConnection{
							{
								From: &streamconfig.Connection{Processor: processorRef1},
								To:   &streamconfig.Connection{Stream: globalStreamRefEnd},
							},
						},
					},
				},
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			filterTree := streamfilter.NewFilterTree()
			resourceM, _ := resources.NewResourceManagement()
			err := BuildFlows(filterTree, testCase.flowReps, processorMng, resourceM)
			if testCase.expectErr {
				require.Error(t, err)
				if testCase.expectedErrMsg != "" {
					require.Contains(t, err.Error(), testCase.expectedErrMsg)
				}
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestGetEdges(t *testing.T) {
	flowGraph := newTestFlow(t, 1)
	addProcessors(t, flowGraph.request, "processor", 1)

	node := flowGraph.request.nodes["processor1"]
	node.edges = append(node.edges, &ConnectionEdge{condition: "condition1"})

	requestEdges := node.GetEdges()
	require.Len(t, requestEdges, 1)
	require.Equal(t, "condition1", requestEdges[0].GetCondition())
}

func testEdges(
	t *testing.T,
	edges []internaltypes.ConnectionEdgeI,
	expectedEdgeNodes, expectedConditions []string,
) {
	require.Len(t, edges, len(expectedEdgeNodes))
	for i, edge := range edges {
		require.True(t, edge.IsValid(), "Edge %d is not valid", i)
		require.Equal(
			t,
			expectedEdgeNodes[i],
			edge.GetTargetNode().GetProcessorKey(),
			"Edge %d processor key does not match",
			i,
		)
		require.Equal(
			t,
			expectedConditions[i],
			edge.GetCondition(),
			"Edge %d condition does not match",
			i,
		)
	}
}

func loadTestCase(t *testing.T, testCase string) map[string]internaltypes.FlowRepI {
	pattern := filepath.Join("test-cases", testCase, "*.yaml")
	files, fileErr := filepath.Glob(pattern)
	require.NoError(t, fileErr, "Failed to find YAML files")

	flowReps := make(map[string]internaltypes.FlowRepI)
	for _, file := range files {
		t.Run(filepath.Base(file), func(t *testing.T) {
			flowRep, err := streamconfig.ReadStreamFlowConfig(file)
			require.NoError(t, err, "Failed to read YAML file")

			flowReps[flowRep.Name] = flowRep

			require.NotEmpty(t, flowRep.Name, "Flow representation name is empty")
			t.Log("Running test case:", flowRep.Name)
		})
	}
	return flowReps
}

func TestTwoFlowsTestCaseYAML(t *testing.T) {
	t.Skip("This test should be modify to only work when the filters are in the same level")
	flowReps := loadTestCase(t, "2-flows*")

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
		},
	)

	// Test building flow
	filterTree := streamfilter.NewFilterTree()
	resourceM, _ := resources.NewResourceManagement()
	err := BuildFlows(filterTree, flowReps, procMng, resourceM)
	require.NoError(t, err, "Failed to build flow")

	// Test first URL
	flowRaw := filterTree.GetFlow(newTestAPIStream("maps.googleapis.com/maps/api/geocode/json"))[0]
	// flowRaw := flow.(*Flow)

	require.NotNil(t, flowRaw)
	require.Equal(t, "GoogleMapsGeocodingCache", flowRaw.GetName())
	require.Equal(t, "maps.googleapis.com/maps/api/geocode/json", flowRaw.GetFilter().GetURL())
	root, err := flowRaw.GetRequestDirection().GetRoot()
	require.NoError(t, err)
	require.NotNil(t, root)

	// ----------------------------------- Request Flow -----------------------------------
	// GoogleMapsGeocodingCache starts from InfraTeam1. The whole flow graph should be like this
	// removePII (InfraTeam1) -> readCache -> (checkLimit/generateResponse) -> globalStream/generateResponse

	require.True(t, root.IsValid())
	require.Equal(t, "removePII", root.GetNode().GetProcessorKey())
	require.Equal(t, "InfraTeam1", root.GetNode().GetFlowGraphName())
	reqEdges := root.GetNode().GetEdges()
	testEdges(t, reqEdges, []string{"readCache"}, []string{""})

	readCacheNode := root.GetNode().GetEdges()[0].GetTargetNode()
	testEdges(
		t,
		readCacheNode.GetEdges(),
		[]string{"checkLimit", "generateResponse"},
		[]string{"cacheMissed", "cacheHit"},
	)

	checkLimitNode := readCacheNode.GetEdges()[0].GetTargetNode()
	require.Len(t, checkLimitNode.GetEdges(), 2)
	require.Equal(t, "below_limit", checkLimitNode.GetEdges()[0].GetCondition())
	require.Equal(t, "globalStream", checkLimitNode.GetEdges()[0].GetTargetStream().GetName())

	require.Equal(t, "above_limit", checkLimitNode.GetEdges()[1].GetCondition())
	require.Equal(
		t,
		"generateResponse",
		checkLimitNode.GetEdges()[1].GetTargetNode().GetProcessorKey(),
	)

	// ----------------------------------- Response Flow -----------------------------------
	// GoogleMapsGeocodingCache starts from globalStream and at the end passes to InfraTeam1.
	// The whole flow graph should be like this:
	// globalStream -> writeCache -> LogAPM (InfraTeam1) -> globalStream
	root, err = flowRaw.GetResponseDirection().GetRoot()
	require.NoError(t, err)
	require.True(t, root.IsValid())
	require.Equal(t, "writeCache", root.GetNode().GetProcessorKey())
	require.Equal(t, "GoogleMapsGeocodingCache", root.GetNode().GetFlowGraphName())
	testEdges(t, root.GetNode().GetEdges(), []string{"LogAPM"}, []string{""})

	logAPMNode := root.GetNode().GetEdges()[0].GetTargetNode()
	require.Equal(t, "InfraTeam1", logAPMNode.GetFlowGraphName())
	require.Len(t, logAPMNode.GetEdges(), 1)
	require.Equal(t, "globalStream", logAPMNode.GetEdges()[0].GetTargetStream().GetName())

	// Test second URL
	flow := filterTree.GetFlow(newTestAPIStream("maps.googleapis.com"))[0]
	flowRaw = flow.(*Flow)
	require.NotNil(t, flowRaw)
	require.Equal(t, "InfraTeam1", flowRaw.GetName())
	require.Equal(t, "*", flowRaw.GetFilter().GetURL())
	root, err = flowRaw.GetRequestDirection().GetRoot()
	require.NoError(t, err)
	require.NotNil(t, root)

	// ----------------------------------- Request Flow -----------------------------------
	// The InfraTeam1 flow graph should be like this: globalStream -> removePII -> globalStream
	require.True(t, root.IsValid())

	removePIINode := root.GetNode()
	require.Equal(t, "InfraTeam1", removePIINode.GetFlowGraphName())
	require.Len(t, removePIINode.GetEdges(), 1)
	require.Equal(t, "globalStream", removePIINode.GetEdges()[0].GetTargetStream().GetName())

	// ----------------------------------- Response Flow -----------------------------------
	// The InfraTeam1 flow graph should be like this: globalStream -> LogAPM -> globalStream
	root, err = flowRaw.GetResponseDirection().GetRoot()
	require.NoError(t, err)
	require.True(t, root.IsValid())

	logAPMNode = root.GetNode()
	require.Equal(t, "InfraTeam1", logAPMNode.GetFlowGraphName())
	require.Len(t, logAPMNode.GetEdges(), 1)
	require.Equal(t, "globalStream", logAPMNode.GetEdges()[0].GetTargetStream().GetName())
}
