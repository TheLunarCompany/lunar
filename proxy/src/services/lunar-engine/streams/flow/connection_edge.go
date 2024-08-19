package streamflow

import (
	streamconfig "lunar/engine/streams/config"
	internal_types "lunar/engine/streams/internal-types"
)

// Ensure interfaces are implemented
var _ internal_types.ConnectionEdgeI = &ConnectionEdge{}

type ExternalEdge struct {
	stream *streamconfig.StreamRef // For stream connections
	flow   *streamconfig.FlowRef   // For flow connections
}

func (ee ExternalEdge) equal(other ExternalEdge) bool {
	// Case 1: Both are stream connections
	if ee.stream != nil && other.stream != nil {
		return ee.stream.Name == other.stream.Name && ee.stream.At == other.stream.At
	}

	// Case 2: Both are flow connections
	if ee.flow != nil && other.flow != nil {
		return ee.flow.Name == other.flow.Name && ee.flow.At == other.flow.At
	}

	return false
}

// ConnectionEdge represents an edge in the DAG.
// It defines the connection between two processors or between a processor and a stream/flow.
type ConnectionEdge struct {
	ExternalEdge

	node      *FlowGraphNode // Target node for processor-to-processor connections
	condition string         // Condition under which this edge is followed, optional
}

// NewConnectionEdge creates a new connection edge.
func NewConnectionEdge(condition string) *ConnectionEdge {
	return &ConnectionEdge{condition: condition}
}

// GetCondition returns the condition for the connection edge.
func (ce *ConnectionEdge) GetCondition() string {
	return ce.condition
}

// GetTargetNode returns the target node for the connection edge.
func (ce *ConnectionEdge) GetTargetNode() internal_types.FlowGraphNodeI {
	return ce.node
}

// GetTargetStream returns the target stream for the connection edge.
func (ce *ConnectionEdge) GetTargetStream() *streamconfig.StreamRef {
	return ce.stream
}

// GetTargetFlow returns the target flow for the connection edge.
func (ce *ConnectionEdge) GetTargetFlow() *streamconfig.FlowRef {
	return ce.flow
}

// IsNodeAvailable checks if the target node is available for the connection edge.
func (ce *ConnectionEdge) IsNodeAvailable() bool {
	return ce.node != nil
}

// IsStreamAvailable checks if the target stream is available for the connection edge.
func (ce *ConnectionEdge) IsStreamAvailable() bool {
	return ce.stream != nil
}

// IsFlowAvailable checks if the target flow is available for the connection edge.
func (ce *ConnectionEdge) IsFlowAvailable() bool {
	return ce.flow != nil
}

// IsValid checks if any target is defined for the connection edge.
func (ce *ConnectionEdge) IsValid() bool {
	return ce.node != nil || ce.stream != nil || ce.flow != nil
}

func (ce *ConnectionEdge) equal(other *ConnectionEdge) bool {
	if ce.condition != other.condition {
		return false
	}

	// compare external edges
	if ce.ExternalEdge.equal(other.ExternalEdge) {
		return true
	}

	// compare target nodes
	if ce.node != nil && other.node != nil && ce.node.equal(other.node) {
		return true
	}

	return false
}
