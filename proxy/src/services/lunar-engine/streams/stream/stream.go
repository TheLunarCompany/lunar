package stream

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	internal_types "lunar/engine/streams/internal-types"
	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
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
	flow internal_types.FlowI,
	apiStream *streamtypes.APIStream,
	node internal_types.FlowGraphNodeI,
) error {
	procIO, err := node.GetProcessor().Execute(apiStream)
	if err != nil {
		return fmt.Errorf("failed to execute processor %s: %w", node.GetProcessorKey(), err)
	}

	log.Debug().Msgf("Executed processor %s. ProcIO: %+v", node.GetProcessorKey(), procIO)

	if apiStream.Type.IsRequestType() {
		s.Request.Actions = append(s.Request.Actions, procIO.ReqAction)
	} else if apiStream.Type.IsResponseType() {
		s.Response.Actions = append(s.Response.Actions, procIO.RespAction)
	} else {
		return fmt.Errorf("unknown stream type: %v", apiStream.Type)
	}

	if procIO.Type.IsResponseType() && apiStream.Type.IsRequestType() {
		// Case of early response. We should perform walk on response flow.
		// Walk on response flow should be started from node with key equal to the key of current node
		node, err = flow.GetResponseDirection().GetNode(node.GetProcessorKey())
		if err != nil {
			return fmt.Errorf("failed to get response node: %w", err)
		}
	}

	for _, edge := range node.GetEdges() {
		if !edge.IsNodeAvailable() {
			// if no node is available, it means node connects to stream, meaning 'end of walk'
			continue
		}
		// Check if the condition is met. procIO.Name - is name of condition.
		// Condition can be met either if it's defined, of if it's just empty string -
		// meaning there is no condition defined (procIO.Name is empty).
		if edge.GetCondition() == procIO.Name {
			targetNode := edge.GetTargetNode()
			if err := s.ExecuteFlow(flow, apiStream, targetNode); err != nil {
				return fmt.Errorf("failed to execute flow: %w", err)
			}
		}
	}
	return nil
}
