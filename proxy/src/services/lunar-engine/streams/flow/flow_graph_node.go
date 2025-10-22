package streamflow

import (
	internaltypes "lunar/engine/streams/internal-types"
	streamtypes "lunar/engine/streams/types"
)

// Ensure interfaces are implemented
var _ internaltypes.FlowGraphNodeI = &FlowGraphNode{}

// FlowGraphNode represents node (Processor) in the DAG.
// It contains the processor definition and the edges for the node.
// The edges are always stored in source node. Each edge contains the target node.
type FlowGraphNode struct {
	flowGraphName string
	processorKey  string
	processor     streamtypes.ProcessorI
	edges         []*ConnectionEdge
}

// NewFlowGraphNode creates a new flow graph node.
func NewFlowGraphNode(
	flowGraphName, processorKey string,
	proc streamtypes.ProcessorI,
) (*FlowGraphNode, error) {
	return &FlowGraphNode{
		flowGraphName: flowGraphName,
		processorKey:  processorKey,
		processor:     proc,
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

// GetProcessorKey returns the processor key for the node.
func (fgn *FlowGraphNode) GetProcessorKey() string {
	return fgn.processorKey
}

// GetProcessor returns the processor for the node.
func (fgn *FlowGraphNode) GetProcessor() streamtypes.ProcessorI {
	return fgn.processor
}

// GetEdges returns the edges for the node based on the flow type.
func (fgn *FlowGraphNode) GetEdges() []internaltypes.ConnectionEdgeI {
	var edges []internaltypes.ConnectionEdgeI
	for _, edge := range fgn.edges {
		edges = append(edges, edge)
	}
	return edges
}
