package streamflow

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	streamtypes "lunar/engine/streams/types"

	internal_types "lunar/engine/streams/internal-types"
)

// Ensure interfaces are implemented
var _ internal_types.FlowDirectionI = &FlowDirection{}

type FlowDirection struct {
	flowName         string
	flowType         streamtypes.StreamType    // Request or Response
	root             *EntryPoint               // Root of the flow
	nodes            map[string]*FlowGraphNode // processor key -> node (Processor)
	graphNodeBuilder *graphNodeBuilder
}

// NewFlowDirection creates a new FlowDirection.
func NewFlowDirection(
	flowRep *streamconfig.FlowRepresentation,
	flowType streamtypes.StreamType,
	graphNodeBuilder *graphNodeBuilder,
) *FlowDirection {
	return &FlowDirection{
		flowName:         flowRep.Name,
		flowType:         flowType,
		graphNodeBuilder: graphNodeBuilder,
		nodes:            make(map[string]*FlowGraphNode),
	}
}

// GetFlowType returns the type of the flow.
func (fd *FlowDirection) GetFlowType() streamtypes.StreamType {
	return fd.flowType
}

// GetRoot returns the root of the FlowDirection.
func (fd *FlowDirection) GetRoot() (internal_types.EntryPointI, error) {
	if !fd.HasValidRoot() {
		return nil, fmt.Errorf("root not found")
	}
	return fd.root, nil
}

// HasValidRoot checks if the FlowGraph has a valid root node.
func (fd *FlowDirection) HasValidRoot() bool {
	return fd.root != nil && fd.root.IsValid()
}

// GetNode retrieves the FlowGraphNode with the specified name from the FlowGraph.
// It returns the node if it exists, otherwise it returns an error.
func (fd *FlowDirection) GetNode(name string) (internal_types.FlowGraphNodeI, error) {
	if node, exists := fd.nodes[name]; exists {
		return node, nil
	}
	return nil, fmt.Errorf("node '%s' not found", name)
}

// setAsRoot sets the provided EntryPoint as the root of the FlowDirection.
func (fd *FlowDirection) setAsRoot(root *EntryPoint) {
	fd.root = root
}

func (fd *FlowDirection) getOrCreateNode(flowName, processorKey string) (*FlowGraphNode, error) {
	if node, exists := fd.nodes[processorKey]; exists {
		return node, nil
	}
	node, err := fd.graphNodeBuilder.buildNode(flowName, processorKey)
	if err != nil {
		return nil, fmt.Errorf("failed to build node '%s': %w", processorKey, err)
	}
	fd.nodes[processorKey] = node
	return node, nil
}
