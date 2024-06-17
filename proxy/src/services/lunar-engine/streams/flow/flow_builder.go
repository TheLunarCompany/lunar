package streamflow

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	internaltypes "lunar/engine/streams/internal-types"
	"lunar/engine/streams/processors"
	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
)

type flowBuilder struct {
	filterTree       internaltypes.FilterTreeI
	flowReps         map[string]*streamconfig.FlowRepresentation
	foreignRoot      *EntryPoint
	nodeBuilder      *graphNodeBuilder
	processorManager *processors.ProcessorManager
}

// newFlowBuilder creates a new instance of a flow builder.
func newFlowBuilder(
	filterTree internaltypes.FilterTreeI,
	flowReps []*streamconfig.FlowRepresentation,
	processorManager *processors.ProcessorManager,
) *flowBuilder {
	builder := &flowBuilder{
		filterTree:       filterTree,
		processorManager: processorManager,
		flowReps:         make(map[string]*streamconfig.FlowRepresentation),
	}
	for _, flowRep := range flowReps {
		builder.flowReps[flowRep.Name] = flowRep
	}

	builder.nodeBuilder = newGraphNodeBuilder(builder.flowReps, builder.processorManager)
	return builder
}

// build function builds flows from provided FlowRepresentations.
func (fb *flowBuilder) build() error {
	for _, flowRep := range fb.flowReps {
		if flowRep == nil || flowRep.Name == "" {
			return fmt.Errorf("flow representation is invalid")
		}

		if err := fb.buildFlow(flowRep); err != nil {
			return fmt.Errorf("failed to build flow %s: %w", flowRep.Name, err)
		}
	}
	return nil
}

// buildFlow builds a flow based on the provided FlowRepresentation.
func (fb *flowBuilder) buildFlow(flowRep *streamconfig.FlowRepresentation) error {
	log.Trace().Msgf("Building flow %s", flowRep.Name)

	flow := NewFlow(fb.nodeBuilder, flowRep)

	// process request and response connections
	if err := fb.buildConnections(flowRep.Name, flow.request, flowRep.Flow.Request); err != nil {
		return fmt.Errorf("failed to build connections for request flow: %w", err)
	}

	if err := fb.buildConnections(flowRep.Name, flow.response, flowRep.Flow.Response); err != nil {
		return fmt.Errorf("failed to build connections for response flow: %w", err)
	}

	// validate the flow
	if err := validateFlow(flow); err != nil {
		return err
	}

	// add the flow to the filter tree
	log.Trace().Msgf("Adding %s with filter on %v to filter tree", flowRep.Name, flowRep.Filters.URL)
	if err := fb.filterTree.AddFlow(flow); err != nil {
		return fmt.Errorf("failed to add flow %s to filter tree: %w", flowRep.Name, err)
	}

	return nil
}

// buildConnections builds connections for the provided FlowDirection.
func (fb *flowBuilder) buildConnections(
	currentFlowName string,
	flowDir *FlowDirection,
	connections []*streamconfig.FlowConnection,
) error {
	for _, conn := range connections {
		if err := fb.buildConnection(currentFlowName, flowDir, conn); err != nil {
			return err
		}
	}
	return nil
}

// buildConnection builds a connection between two nodes.
func (fb *flowBuilder) buildConnection(
	currentFlowName string,
	flowDir *FlowDirection,
	conn *streamconfig.FlowConnection,
) error {
	// connections to Processor
	if conn.To.Processor != nil {
		// Processor -> Processor
		if conn.From.Processor != nil {
			return fb.connectProcessors(currentFlowName, flowDir, conn)
		}

		// Stream -> Processor
		if conn.From.Stream != nil && conn.From.Stream.At == streamtypes.StreamStart {
			return fb.connectStreamToProcessor(currentFlowName, flowDir, conn)
		}

		// Flow -> Processor
		if conn.From.Flow != nil && conn.From.Flow.At == internaltypes.FlowEnd {
			return fb.connectFlowToProcessor(currentFlowName, flowDir, conn)
		}
	}

	// connections from Processor
	if conn.From.Processor != nil {
		// Processor -> Stream
		if conn.To.Stream != nil && conn.To.Stream.At == streamtypes.StreamEnd {
			return fb.connectProcessorToStream(currentFlowName, flowDir, conn)
		}

		// Processor -> Flow
		if conn.To.Flow != nil && conn.To.Flow.At == internaltypes.FlowStart {
			return fb.connectProcessorToFlow(currentFlowName, flowDir, conn)
		}
	}

	return fmt.Errorf("invalid connection configuration")
}

// connectProcessorToFlow adds a connection between a processor and a flow.
func (fb *flowBuilder) connectProcessorToFlow(
	currentFlowName string,
	flowDir *FlowDirection,
	conn *streamconfig.FlowConnection,
) error {
	sourceNode, err := flowDir.getOrCreateNode(currentFlowName, conn.From.Processor.Name)
	if err != nil {
		return err
	}

	targetFlowName := conn.To.Flow.Name
	// will incorporate nodes/connections from the target flow into the current flow
	if err := fb.incorporateFlow(targetFlowName, flowDir); err != nil {
		return fmt.Errorf("failed to incorporate flow %s: %w", targetFlowName, err)
	}

	// calling includeFlow had to define root of the flow being incorporated.
	if fb.foreignRoot == nil {
		return fmt.Errorf("foreign root node not found")
	}

	// setting root of the flow being incorporated as our connection
	edge := NewConnectionEdge(conn.From.Processor.Condition)
	edge.node = fb.foreignRoot.node
	fb.foreignRoot = nil

	sourceNode.addEdge(edge)
	return nil
}

// connectFlowToProcessor adds a connection between a flow and a processor.
func (fb *flowBuilder) connectFlowToProcessor(
	currentFlowName string,
	flowDir *FlowDirection,
	conn *streamconfig.FlowConnection,
) error {
	targetNode, err := flowDir.getOrCreateNode(currentFlowName, conn.To.Processor.Name)
	if err != nil {
		return err
	}

	root := NewEntryPoint(targetNode)
	root.flow = conn.From.Flow
	flowDir.setAsRoot(root)

	// flow from which we have connection to this processor
	sourceFlowName := conn.From.Flow.Name
	if err := fb.incorporateFlow(sourceFlowName, flowDir); err != nil {
		return fmt.Errorf("failed to incorporate flow %s: %w", sourceFlowName, err)
	}

	// calling includeFlow had to define root of the flow being incorporated.
	if fb.foreignRoot == nil {
		return fmt.Errorf("foreign root node not found")
	}

	// setting root of the flow being incorporated as our root
	flowDir.setAsRoot(fb.foreignRoot)
	fb.foreignRoot = nil

	return nil
}

// incorporateFlow gets processors and connections from source flow
// and incorporates them into specified FlowDirection
func (fb *flowBuilder) incorporateFlow(flowName string, targetFlowDir *FlowDirection) error {
	flowRep, exists := fb.flowReps[flowName]
	if !exists {
		return fmt.Errorf("flow '%s' not found", flowName)
	}

	// build connections from the source flow and add all to target FlowDirection
	connections := flowRep.Flow.GetFlowConnections(targetFlowDir.flowType)
	if err := fb.buildConnections(flowName, targetFlowDir, connections); err != nil {
		return fmt.Errorf("failed to build connections for flow %s: %w", flowName, err)
	}

	return nil
}

// connectProcessorToStream adds a connection between a processor and a stream.
func (fb *flowBuilder) connectProcessorToStream(
	currentFlowName string,
	flowDir *FlowDirection,
	conn *streamconfig.FlowConnection,
) error {
	sourceNode, err := flowDir.getOrCreateNode(currentFlowName, conn.From.Processor.Name)
	if err != nil {
		return err
	}

	edge := NewConnectionEdge(conn.From.Processor.Condition)

	if flowDir.flowType.IsRequestType() && sourceNode.flowGraphName != flowDir.flowName {
		// case when processor is really connected to another flow and not to stream
		// in this case, we will connect this node to the root node of the connected flow
		if flowDir.root == nil {
			return fmt.Errorf("root node not found for flow %s", flowDir.flowName)
		}
		edge.node = flowDir.root.node
	} else {
		edge.stream = conn.To.Stream
	}

	sourceNode.addEdge(edge)
	return nil
}

// addStreamConnection adds a connection between a stream and a processor.
func (fb *flowBuilder) connectStreamToProcessor(
	currentFlowName string,
	flowDir *FlowDirection,
	conn *streamconfig.FlowConnection,
) error {
	targetNode, err := flowDir.getOrCreateNode(currentFlowName, conn.To.Processor.Name)
	if err != nil {
		return err
	}

	root := NewEntryPoint(targetNode)
	root.stream = conn.From.Stream

	// root will be set if node is from the same flow (and not being incorporated from another flow)
	if flowDir.flowName == targetNode.flowGraphName {
		flowDir.setAsRoot(root)
	} else {
		fb.foreignRoot = root
	}
	return nil
}

// addProcessorConnection adds a connection between processors.
func (fb *flowBuilder) connectProcessors(
	currentFlowName string,
	flowDir *FlowDirection,
	conn *streamconfig.FlowConnection,
) error {
	sourceNode, err := flowDir.getOrCreateNode(currentFlowName, conn.From.Processor.Name)
	if err != nil {
		return err
	}

	targetNode, err := flowDir.getOrCreateNode(currentFlowName, conn.To.Processor.Name)
	if err != nil {
		return err
	}

	edge := NewConnectionEdge(conn.From.Processor.Condition)
	edge.node = targetNode

	sourceNode.addEdge(edge)
	return nil
}
