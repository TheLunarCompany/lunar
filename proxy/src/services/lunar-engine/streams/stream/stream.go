package stream

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
)

type ProcessorExecuteFunc func() (streamtypes.ProcessorIO, error)

type Stream struct {
	measureProcExecutionTime func(ProcessorExecuteFunc) (streamtypes.ProcessorIO, error)
	Request                  *streamconfig.RequestStream
	Response                 *streamconfig.ResponseStream
}

func NewStream() *Stream {
	return &Stream{
		Request:  &streamconfig.RequestStream{},
		Response: &streamconfig.ResponseStream{},
	}
}

func (s *Stream) WithProcessorExecutionTimeMeasurement(fnMeasure func(ProcessorExecuteFunc) (
	streamtypes.ProcessorIO,
	error,
),
) *Stream {
	s.measureProcExecutionTime = fnMeasure
	return s
}

func (s *Stream) GetRequestStream() *streamconfig.RequestStream {
	return s.Request
}

func (s *Stream) GetResponseStream() *streamconfig.ResponseStream {
	return s.Response
}

func (s *Stream) ExecuteFlow(
	flow internaltypes.FlowI,
	apiStream publictypes.APIStreamI,
	node internaltypes.FlowGraphNodeI,
	actions *streamconfig.StreamActions,
) (err error) {
	closureFunc := func() (streamtypes.ProcessorIO, error) {
		return node.GetProcessor().Execute(apiStream)
	}
	var procIO streamtypes.ProcessorIO
	if s.measureProcExecutionTime != nil {
		procIO, err = s.measureProcExecutionTime(closureFunc)
	} else {
		procIO, err = closureFunc()
	}
	if err != nil {
		return fmt.Errorf("failed to execute processor %s: %w", node.GetProcessorKey(), err)
	}

	log.Debug().Msgf("Executed processor %s. ProcIO: %+v", node.GetProcessorKey(), procIO)

	if apiStream.GetType().IsRequestType() {
		if procIO.IsRequestActionAvailable() {
			if procIO.ReqAction.IsEarlyReturnType() {
				// If the request is early response, we should drop the request slot from the quota
				// to allow other requests to be processed
				flow.GetResourceManagement().OnRequestDrop(apiStream)
			}
			actions.Request.Actions = append(actions.Request.Actions, procIO.ReqAction)
		}
	} else if apiStream.GetType().IsResponseType() {
		if procIO.IsResponseActionAvailable() {
			actions.Response.Actions = append(actions.Response.Actions, procIO.RespAction)
		}
	} else {
		return fmt.Errorf("unknown stream type: %v", apiStream.GetType())
	}

	if procIO.Type.IsResponseType() && apiStream.GetType().IsRequestType() {
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
			if err := s.ExecuteFlow(flow, apiStream, targetNode, actions); err != nil {
				return fmt.Errorf("failed to execute flow: %w", err)
			}
		}
	}
	return nil
}
