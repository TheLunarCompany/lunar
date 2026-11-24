package streamflow

import (
	"fmt"
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
)

// Ensure interfaces are implemented
var _ internaltypes.FlowDirectionI = &FlowDirection{}

type FlowDirection struct {
	flowName         string
	flowType         publictypes.StreamType    // Request or Response
	root             *EntryPoint               // Root of the flow
	nodes            map[string]*FlowGraphNode // processor key -> node (Processor)
	graphNodeBuilder *graphNodeBuilder
}

// NewFlowDirection creates a new FlowDirection.
func NewFlowDirection(
	flowRep internaltypes.FlowRepI,
	flowType publictypes.StreamType,
	graphNodeBuilder *graphNodeBuilder,
) *FlowDirection {
	return &FlowDirection{
		flowName:         flowRep.GetName(),
		flowType:         flowType,
		graphNodeBuilder: graphNodeBuilder,
		nodes:            make(map[string]*FlowGraphNode),
	}
}

// GetFlowType returns the type of the flow.
func (fd *FlowDirection) GetFlowType() publictypes.StreamType {
	return fd.flowType
}

// GetRoot returns the root of the FlowDirection.
func (fd *FlowDirection) GetRoot() (internaltypes.EntryPointI, error) {
	// if !fd.HasValidRoot() {
	// 	return nil, fmt.Errorf("root not found")
	// }
	return fd.root, nil
}

// IsDefined checks if the FlowDirection is defined.
func (fd *FlowDirection) IsDefined() bool {
	return len(fd.nodes) > 0
}

// HasValidRoot checks if the FlowGraph has a valid root node.
func (fd *FlowDirection) HasValidRoot() bool {
	return fd.root != nil && fd.root.IsValid()
}

// GetNode retrieves the FlowGraphNode with the specified name from the FlowGraph.
// It returns the node if it exists, otherwise it returns an error.
func (fd *FlowDirection) GetNode(name string) (internaltypes.FlowGraphNodeI, error) {
	if node, exists := fd.nodes[name]; exists {
		return node, nil
	}
	return nil, fmt.Errorf("node '%s' not found", name)
}

// setAsRoot sets the provided EntryPoint as the root of the FlowDirection.
func (fd *FlowDirection) setAsRoot(root *EntryPoint) {
	fd.root = root
}

func (fd *FlowDirection) getOrCreateNode(
	flowName string,
	processor internaltypes.ProcessorRefI,
) (*FlowGraphNode, error) {
	processorKey := processor.GetReferenceName()

	if node, exists := fd.nodes[processorKey]; exists {
		return node, nil
	}

	node, err := fd.graphNodeBuilder.buildNode(flowName, processor)
	if err != nil {
		return nil, fmt.Errorf("failed to build node '%s': %w", processorKey, err)
	}
	fd.nodes[processorKey] = node
	return node, nil
}
