package stream

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	internal_types "lunar/engine/streams/internal-types"
	streamtypes "lunar/engine/streams/types"
)

type Stream struct {
	Request  *streamconfig.RequestStream
	Response *streamconfig.ResponseStream
}

func NewStream() *Stream {
	return &Stream{
		Request:  &streamconfig.RequestStream{},
		Response: &streamconfig.ResponseStream{},
	}
}

func (s *Stream) GetRequestStream() *streamconfig.RequestStream {
	return s.Request
}

func (s *Stream) GetResponseStream() *streamconfig.ResponseStream {
	return s.Response
}

func (s *Stream) ExecuteFlow(
	apiStream *streamtypes.APIStream,
	node internal_types.FlowGraphNodeI,
) error {
	procIO, err := node.GetProcessor().Execute(apiStream)
	if err != nil {
		return fmt.Errorf("failed to execute processor %s: %w", node.GetProcessor().GetName(), err)
	}

	for _, edge := range node.GetEdges() {
		if !edge.IsNodeAvailable() {
			// if no node is available, it must be stream meaning - end of walk.
			continue
		}
		// Check if the condition is met. procIO.Name - is name of condition.
		// Condition can be met either if it's defined, of id it's just empty string -
		// meaning there is no condition defined. (procIO.Name is empty).
		if edge.GetCondition() == procIO.Name {
			targetNode := edge.GetTargetNode()
			return s.ExecuteFlow(apiStream, targetNode)
		}
	}
	return nil
}
