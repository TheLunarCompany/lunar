package streamflow

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	internal_types "lunar/engine/streams/internal-types"
	processormock "lunar/engine/streams/processors/mock"
	streamtypes "lunar/engine/streams/types"
)

// Ensure interfaces are implemented
var _ internal_types.FlowGraphNodeI = &FlowGraphNode{}

// FlowGraphNode represents node (Processor) in the DAG.
// It contains the processor definition and the edges for the node.
// The edges are always stored in source node. Each edge contains the target node.
type FlowGraphNode struct {
	flowGraphName   string
	processorKey    string
	processor       streamtypes.Processor
	processorConfig *streamconfig.Processor
	edges           []*ConnectionEdge
}

// NewFlowGraphNode creates a new flow graph node.
func NewFlowGraphNode(
	flowGraphName, processorKey string,
	procConf streamconfig.Processor,
) (*FlowGraphNode, error) {
	// TODO: Create real processor based on the processor configuration, not mock
	proc, err := processormock.NewProcessorFromConfig(procConf)
	if err != nil {
		return nil, fmt.Errorf("failed to create processor '%s': %w", processorKey, err)
	}

	return &FlowGraphNode{
		flowGraphName:   flowGraphName,
		processorKey:    processorKey,
		processor:       proc,
		processorConfig: &procConf,
	}, nil
}

// equal checks if the nodes are equal.
func (fgn *FlowGraphNode) equal(other *FlowGraphNode) bool {
	return fgn.processorKey == other.processorKey
}

// addEdge adds an edge to the node.
func (fgn *FlowGraphNode) addEdge(edge *ConnectionEdge) {
	// Check if the edge already exists
	for _, existingEdge := range fgn.edges {
		if existingEdge.equal(edge) {
			return // Edge already exists, do not add
		}
	}

	// Edge is unique, proceed with adding
	fgn.edges = append(fgn.edges, edge)
}

// GetFlowGraphName returns the name of the flow graph this node belongs to
func (fgn *FlowGraphNode) GetFlowGraphName() string {
	return fgn.flowGraphName
}

// GetProcessor returns the processor for the node.
func (fgn *FlowGraphNode) GetProcessor() streamtypes.Processor {
	return fgn.processor
}

// GetEdges returns the edges for the node based on the flow type.
func (fgn *FlowGraphNode) GetEdges() []internal_types.ConnectionEdgeI {
	var edges []internal_types.ConnectionEdgeI
	for _, edge := range fgn.edges {
		edges = append(edges, edge)
	}
	return edges
}
