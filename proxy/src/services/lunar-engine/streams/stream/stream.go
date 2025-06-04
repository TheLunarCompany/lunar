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

type ShortCircuitData struct {
	Node                   internaltypes.FlowGraphNodeI
	IsInternalShortCircuit bool
}

type Stream struct {
	getMeasureProcExecFunc func(string) func(string, publictypes.APIStreamI, ProcessorExecuteFunc) (streamtypes.ProcessorIO, error) //nolint:lll
	Request                *streamconfig.RequestStream
	Response               *streamconfig.ResponseStream
}

func NewStream() *Stream {
	return &Stream{
		Request:  &streamconfig.RequestStream{},
		Response: &streamconfig.ResponseStream{},
	}
}

func (s *Stream) WithProcExecutionMeasurement(
	fnMeasure func(string) func(string, publictypes.APIStreamI, ProcessorExecuteFunc) (streamtypes.ProcessorIO, error), //nolint:lll
) *Stream {
	s.getMeasureProcExecFunc = fnMeasure
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
) (*ShortCircuitData, error) {
	closureFunc := func() (streamtypes.ProcessorIO, error) {
		return node.GetProcessor().Execute(flow.GetName(), apiStream)
	}
	var err error
	var shortCircuitData *ShortCircuitData // internaltypes.FlowGraphNodeI
	var procIO streamtypes.ProcessorIO
	if s.getMeasureProcExecFunc != nil {
		measureFunc := s.getMeasureProcExecFunc(node.GetProcessorKey())
		procIO, err = measureFunc(flow.GetName(), apiStream, closureFunc)
	} else {
		procIO, err = closureFunc()
	}
	if err != nil {
		return shortCircuitData,
			fmt.Errorf("failed to execute processor %s: %w", node.GetProcessorKey(), err)
	}

	log.Debug().Msgf("Executed processor %s. ProcIO: %+v", node.GetProcessorKey(), procIO)

	if procIO.ShortCircuit != nil {
		log.Trace().Msgf("Internal short circuit is used for request %s", apiStream.GetName())
		// Short circuit is used to stop the flow execution and return the result
		if procIO.ShortCircuit.ReqAction != nil {
			// Short circuit is used to stop the flow execution and return the result
			actions.Request.Actions = append(actions.Request.Actions, procIO.ShortCircuit.ReqAction)
		} else if procIO.ShortCircuit.RespAction != nil {
			// Short circuit is used to stop the flow execution and return the result
			actions.Response.Actions = append(actions.Response.Actions, procIO.ShortCircuit.RespAction)
		}

		shortCircuitData = &ShortCircuitData{IsInternalShortCircuit: true}

		return shortCircuitData, nil
	}

	if apiStream.GetActionsType().IsRequestType() {
		if procIO.IsRequestActionAvailable() {
			if procIO.ReqAction.IsEarlyReturnType() {
				// If the request is early response, we should drop the request slot from the quota
				// to allow other requests to be processed
				flow.GetResourceManagement().OnRequestDrop(apiStream)
			}
			actions.Request.Actions = append(actions.Request.Actions, procIO.ReqAction)
		}
	} else if apiStream.GetActionsType().IsResponseType() {
		if procIO.IsResponseActionAvailable() {
			actions.Response.Actions = append(actions.Response.Actions, procIO.RespAction)
		}
	} else {
		return shortCircuitData, fmt.Errorf("unknown stream type: %v", apiStream.GetType())
	}

	// TODO: Detach this and use this node only when executing the responses in streams.go
	if procIO.Type.IsResponseType() && apiStream.GetType().IsRequestType() {
		// Case of early response. We should perform walk on response flow.
		// Walk on response flow should be started from node with key equal to the key of current node
		node, err = flow.GetResponseDirection().GetNode(node.GetProcessorKey())
		if err != nil {
			return shortCircuitData, fmt.Errorf("failed to get response node: %w", err)
		}
		shortCircuitData = &ShortCircuitData{Node: node, IsInternalShortCircuit: false}
		return shortCircuitData, nil
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
			if shortCircuitData, err = s.ExecuteFlow(flow, apiStream, targetNode, actions); err != nil {
				return shortCircuitData, fmt.Errorf("failed to execute flow: %w", err)
			}
		}
	}
	return shortCircuitData, nil
}
