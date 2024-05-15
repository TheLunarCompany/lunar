package streamflow

import (
	streamconfig "lunar/engine/streams/config"
	internal_types "lunar/engine/streams/internal-types"
)

// Ensure interfaces are implemented
var _ internal_types.EntryPointI = &EntryPoint{}

// EntryPoint represents an entry point of the flow graph,
// where flow graph can be connected to the outside world (stream or another flow).
type EntryPoint struct {
	node *FlowGraphNode

	ExternalEdge // stream or flow connection
}

func NewEntryPoint(node *FlowGraphNode) *EntryPoint {
	return &EntryPoint{
		node: node,
	}
}

// GetNode returns the node reference.
func (ep *EntryPoint) GetNode() internal_types.FlowGraphNodeI {
	return ep.node
}

// GetStream returns the stream reference.
func (ep *EntryPoint) GetStream() *streamconfig.StreamRef {
	return ep.stream
}

// GetFlow returns the flow reference.
func (ep *EntryPoint) GetFlow() *streamconfig.FlowRef {
	return ep.flow
}

// IsValid checks if the border point is valid.
func (ep *EntryPoint) IsValid() bool {
	if ep.stream != nil && ep.flow != nil {
		return false // both can't be defined
	}
	return ep.node != nil &&
		(ep.stream != nil || ep.flow != nil)
}
