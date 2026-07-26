package streamflow

import (
	"fmt"
	configstate "lunar/engine/streams/config-state"
	internaltypes "lunar/engine/streams/internal-types"
	"lunar/engine/streams/processors"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/streams/resources"
	"lunar/engine/utils"

	"github.com/rs/zerolog/log"
)

type flowBuilder struct {
	filterTree         internaltypes.FilterTreeI
	flowReps           map[string]internaltypes.FlowRepI
	foreignRoot        *EntryPoint
	nodeBuilder        *graphNodeBuilder
	processorManager   *processors.ProcessorManager
	resourceManagement *resources.ResourceManagement
}

// newFlowBuilder creates a new instance of a flow builder.
func newFlowBuilder(filterTree internaltypes.FilterTreeI,
	flowReps map[string]internaltypes.FlowRepI,
	processorManager *processors.ProcessorManager,
	resourceManagement *resources.ResourceManagement,
) *flowBuilder {
	builder := &flowBuilder{
		filterTree:         filterTree,
		processorManager:   processorManager,
		resourceManagement: resourceManagement,
		flowReps:           flowReps,
	}

	builder.nodeBuilder = newGraphNodeBuilder(builder.flowReps, builder.processorManager)
	return builder
}

// build function builds flows from provided FlowRepresentations.
func (fb *flowBuilder) build() error {
	pendingFlows := make(map[string]struct{})
	for _, flowRep := range fb.flowReps {
		if flowRep == nil || flowRep.GetName() == "" {
			return fmt.Errorf("flow representation is invalid")
		}

		if err := fb.buildFlow(flowRep); err != nil {
			pendingFlows[flowRep.GetName()] = struct{}{}
		}
	}

	// try to build pending flows
	for flowName := range pendingFlows {
		flowRep, exists := fb.flowReps[flowName]
		if !exists {
			return fmt.Errorf("flow '%s' not found", flowName)
		}
		if err := fb.buildFlow(flowRep); err != nil {
			return fmt.Errorf("failed to build flow %s: %w", flowName, err)
		}
	}
	return nil
}

// buildFlow builds a flow based on the provided FlowRepresentation.
func (fb *flowBuilder) buildFlow(flowRep internaltypes.FlowRepI) error {
	log.Info().Msgf("Building flow %s", flowRep.GetName())

	flow := NewFlow(fb.nodeBuilder, flowRep, fb.resourceManagement)

	// process request and response connections
	if err := fb.buildConnections(
		flowRep.GetName(), flow.request, flowRep.GetFlow().GetRequest()); err != nil {
		return fmt.Errorf("failed to build connections for request flow: %w", err)
	}

	if err := fb.buildConnections(
		flowRep.GetName(), flow.response, flowRep.GetFlow().GetResponse()); err != nil {
		return fmt.Errorf("failed to build connections for response flow: %w", err)
	}

	// validate the flow
	if err := validateFlow(flow); err != nil {
		return err
	}

	// add the flow to the filter tree
	log.Info().Msgf("Adding %s with filter on %v to filter tree",
		flowRep.GetName(),
		flowRep.GetFilter().GetURLs(),
	)
	if err := fb.filterTree.AddFlow(flow); err != nil {
		return fmt.Errorf("failed to add flow %s to filter tree: %w", flowRep.GetName(), err)
	}

	configstate.Get().AddFlow(flow)

	return nil
}

// buildConnections builds connections for the provided FlowDirection.
func (fb *flowBuilder) buildConnections(
	currentFlowName string,
	flowDir *FlowDirection,
	connections []internaltypes.FlowConnRepI,
) error {
	for _, conn := range connections {
		if err := fb.buildConnection(currentFlowName, flowDir, conn); err != nil {
			return err
		}
	}
	return nil
}

// validateCondition validates the condition for a processor.
func (fb *flowBuilder) validateCondition(
	streamType publictypes.StreamType,
	flowName string,
	procRef internaltypes.ProcessorRefI,
) error {
	procDef := fb.processorManager.GetProcessorDefinitionByKey(flowName, procRef)
	if procDef == nil {
		return nil
	}

	return procDef.CheckCondition(procRef.GetCondition(), streamType)
}

// buildConnection builds a connection between two nodes.
func (fb *flowBuilder) buildConnection(
	currentFlowName string,
	flowDir *FlowDirection,
	conn internaltypes.FlowConnRepI,
) error {
	if !utils.IsInterfaceNil(conn.GetFrom().GetProcessor()) {
		procRef := conn.GetFrom().GetProcessor()
		if err := fb.validateCondition(flowDir.flowType, currentFlowName, procRef); err != nil {
			return fmt.Errorf("invalid condition for processor %s: %w", procRef.GetName(), err)
		}
	}

	// connections to Processor
	if !utils.IsInterfaceNil(conn.GetTo().GetProcessor()) {
		// Processor -> Processor
		if !utils.IsInterfaceNil(conn.GetFrom().GetProcessor()) {
			return fb.connectProcessors(currentFlowName, flowDir, conn)
		}

		// Stream -> Processor
		if !utils.IsInterfaceNil(conn.GetFrom().GetStream()) &&
			conn.GetFrom().GetStream().GetAt() == publictypes.StreamStart {
			return fb.connectStreamToProcessor(currentFlowName, flowDir, conn)
		}

		// Flow -> Processor
		if !utils.IsInterfaceNil(conn.GetFrom().GetFlow()) &&
			conn.GetFrom().GetFlow().GetAt() == internaltypes.FlowEnd {
			return fb.connectFlowToProcessor(currentFlowName, flowDir, conn)
		}
	}

	// connections from Processor
	if !utils.IsInterfaceNil(conn.GetFrom().GetProcessor()) {
		// Processor -> Stream
		if !utils.IsInterfaceNil(conn.GetTo().GetStream()) &&
			conn.GetTo().GetStream().GetAt() == publictypes.StreamEnd {
			return fb.connectProcessorToStream(currentFlowName, flowDir, conn)
		}

		// Processor -> Flow
		if !utils.IsInterfaceNil(conn.GetTo().GetFlow()) &&
			conn.GetTo().GetFlow().GetAt() == internaltypes.FlowStart {
			return fb.connectProcessorToFlow(currentFlowName, flowDir, conn)
		}
	}

	if !utils.IsInterfaceNil(conn.GetFrom().GetStream()) &&
		!utils.IsInterfaceNil(conn.GetTo().GetStream()) {
		// Stream -> Stream
		return nil
	}

	return fmt.Errorf("invalid connection configuration")
}

// connectProcessorToFlow adds a connection between a processor and a flow.
func (fb *flowBuilder) connectProcessorToFlow(
	currentFlowName string,
	flowDir *FlowDirection,
	conn internaltypes.FlowConnRepI,
) error {
	sourceNode, err := flowDir.getOrCreateNode(
		currentFlowName, conn.GetFrom().GetProcessor())
	if err != nil {
		return err
	}

	targetFlowName := conn.GetTo().GetFlow().GetName()
	// will incorporate nodes/connections from the target flow into the current flow
	if err := fb.incorporateFlow(targetFlowName, flowDir); err != nil {
		return fmt.Errorf("failed to incorporate flow %s: %w", targetFlowName, err)
	}

	// calling includeFlow had to define root of the flow being incorporated.
	if fb.foreignRoot == nil {
		return fmt.Errorf("foreign root node not found")
	}

	// setting root of the flow being incorporated as our connection
	edge := NewConnectionEdge(conn.GetFrom().GetProcessor().GetCondition())
	edge.node = fb.foreignRoot.node
	fb.foreignRoot = nil

	sourceNode.addEdge(edge)
	return nil
}

// connectFlowToProcessor adds a connection between a flow and a processor.
func (fb *flowBuilder) connectFlowToProcessor(
	currentFlowName string,
	flowDir *FlowDirection,
	conn internaltypes.FlowConnRepI,
) error {
	targetNode, err := flowDir.getOrCreateNode(currentFlowName, conn.GetTo().GetProcessor())
	if err != nil {
		return err
	}

	root := NewEntryPoint(targetNode)
	root.flow = conn.GetFrom().GetFlow()
	flowDir.setAsRoot(root)

	// flow from which we have connection to this processor
	sourceFlowName := conn.GetFrom().GetFlow().GetName()
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
	connections := flowRep.GetFlow().GetFlowConnections(targetFlowDir.flowType)
	if err := fb.buildConnections(flowName, targetFlowDir, connections); err != nil {
		return fmt.Errorf("failed to build connections for flow %s: %w", flowName, err)
	}

	return nil
}

// connectProcessorToStream adds a connection between a processor and a stream.
func (fb *flowBuilder) connectProcessorToStream(
	currentFlowName string,
	flowDir *FlowDirection,
	conn internaltypes.FlowConnRepI,
) error {
	sourceNode, err := flowDir.getOrCreateNode(
		currentFlowName, conn.GetFrom().GetProcessor())
	if err != nil {
		return err
	}

	edge := NewConnectionEdge(conn.GetFrom().GetProcessor().GetCondition())

	if flowDir.flowType.IsRequestType() && sourceNode.flowGraphName != flowDir.flowName {
		// case when processor is really connected to another flow and not to stream
		// in this case, we will connect this node to the root node of the connected flow
		if flowDir.root == nil {
			return fmt.Errorf("root node not found for flow %s", flowDir.flowName)
		}
		edge.node = flowDir.root.node
	} else {
		edge.stream = conn.GetTo().GetStream()
	}

	sourceNode.addEdge(edge)
	return nil
}

// addStreamConnection adds a connection between a stream and a processor.
func (fb *flowBuilder) connectStreamToProcessor(
	currentFlowName string,
	flowDir *FlowDirection,
	conn internaltypes.FlowConnRepI,
) error {
	targetNode, err := flowDir.getOrCreateNode(currentFlowName, conn.GetTo().GetProcessor())
	if err != nil {
		return err
	}

	root := NewEntryPoint(targetNode)
	root.stream = conn.GetFrom().GetStream()

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
	conn internaltypes.FlowConnRepI,
) error {
	sourceNode, err := flowDir.getOrCreateNode(
		currentFlowName, conn.GetFrom().GetProcessor())
	if err != nil {
		return err
	}

	targetNode, err := flowDir.getOrCreateNode(currentFlowName, conn.GetTo().GetProcessor())
	if err != nil {
		return err
	}

	edge := NewConnectionEdge(conn.GetFrom().GetProcessor().GetCondition())
	edge.node = targetNode

	sourceNode.addEdge(edge)
	return nil
}
