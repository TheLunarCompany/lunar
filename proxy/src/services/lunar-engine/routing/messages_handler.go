package routing

import (
	"bytes"
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/config"
	lunar_messages "lunar/engine/messages"
	"lunar/engine/runner"
	stream_config "lunar/engine/streams/config"
	lunar_context "lunar/engine/streams/lunar-context"
	stream_types "lunar/engine/streams/types"
	"lunar/engine/utils"
	context_manager "lunar/toolkit-core/context-manager"
	"lunar/toolkit-core/otel"
	"reflect"

	"github.com/negasus/haproxy-spoe-go/action"
	"github.com/negasus/haproxy-spoe-go/message"
	"github.com/negasus/haproxy-spoe-go/payload/kv"
	"github.com/negasus/haproxy-spoe-go/request"
	"github.com/rs/zerolog/log"
)

type (
	MessageHandler func(msgs *request.Request)
	MessageType    int
)

const (
	requestType MessageType = iota
	responseType
)

var sharedState = lunar_context.NewMemoryState[[]byte]()

func Handler(data *HandlingDataManager) MessageHandler {
	data.RunDiagnosisWorker()
	ctxMng := context_manager.Get()
	handlerInner := func(req *request.Request) {
		var actions action.Actions
		if requestMessage, err := getMessageByType(requestType, req.Messages); err == nil {
			_, span := otel.Tracer(ctxMng.GetContext(), "routing#lunarOnRequestMessage")
			defer span.End()
			actions, err = processRequest(requestMessage, data)
			if ctxMng.GetContext().Err() != nil {
				actions = getShutdownActions()
			} else if err != nil {
				log.Error().Err(err).Msg("Error processing request")
				return
			}
		}

		if responseMessage, err := getMessageByType(responseType, req.Messages); err == nil {
			_, span := otel.Tracer(ctxMng.GetContext(), "routing#lunarOnResponseMessage")
			defer span.End()
			actions, err = processResponse(responseMessage, data)
			if err != nil {
				log.Error().Err(err).Msg("Error processing response")
				return
			}
		}
		req.Actions = actions
	}

	return handlerInner
}

func getMessageByType(
	messageType MessageType,
	incomingMessage *message.Messages,
) (msg *message.Message, err error) {
	switch messageType {
	case requestType:
		msg, err = incomingMessage.GetByName(lunar_messages.LunarRequest)
		if err != nil {
			msg, err = incomingMessage.GetByName(lunar_messages.LunarFullRequest)
		}
		return msg, err
	case responseType:
		msg, err = incomingMessage.GetByName(lunar_messages.LunarResponse)
		if err != nil {
			msg, err = incomingMessage.GetByName(lunar_messages.LunarFullResponse)
		}
	default:
		err = fmt.Errorf("unknown message type %v", messageType)
	}
	return msg, err
}

func getSPOEReqActions(
	args lunar_messages.OnRequest,
	lunarActions []actions.ReqLunarAction,
) action.Actions {
	var prioritizedAction actions.ReqLunarAction = &actions.NoOpAction{}
	for _, lunarAction := range lunarActions {
		lunarAction.EnsureRequestIsUpdated(&args)
		prioritizedAction = prioritizedAction.ReqPrioritize(lunarAction)
	}

	t := reflect.TypeOf(prioritizedAction)
	log.Trace().Msgf("Prioritized OnRequest action: %v", t.String())

	prioritizedAction.EnsureRequestIsUpdated(&args)
	return prioritizedAction.ReqToSpoeActions()
}

func getShutdownActions() action.Actions {
	generateResp := action.Actions{}
	generateResp.SetVar(action.ScopeTransaction, actions.ReturnEarlyResponseActionName, true)
	generateResp.SetVar(action.ScopeTransaction, actions.StatusCodeActionName, 503)
	generateResp.SetVar(action.ScopeTransaction, actions.ResponseBodyActionName,
		[]byte("Lunar Gateway is shutting down"))
	generateResp.SetVar(action.ScopeTransaction, actions.ResponseHeadersActionName,
		utils.DumpHeaders(map[string]string{}))

	return generateResp
}

func getSPOERespActions(
	args lunar_messages.OnResponse,
	lunarActions []actions.RespLunarAction,
) action.Actions {
	var prioritizedAction actions.RespLunarAction = &actions.NoOpAction{}
	for _, lunarAction := range lunarActions {
		lunarAction.EnsureResponseIsUpdated(&args)
		prioritizedAction = prioritizedAction.RespPrioritize(lunarAction)
	}
	t := reflect.TypeOf(prioritizedAction)
	log.Trace().Msgf("Prioritized OnResponse action: %v", t.String())

	prioritizedAction.EnsureResponseIsUpdated(&args)
	return prioritizedAction.RespToSpoeActions()
}

func processRequest(msg *message.Message, data *HandlingDataManager) (action.Actions, error) {
	var err error
	var actions action.Actions
	args := readRequestArgs(msg)
	log.Trace().Msgf("On request args: %+v\n", args)
	if data.IsStreamsEnabled() {
		apiStream := stream_types.NewRequestAPIStream(args, sharedState)
		if args.IsFullRequest() {
			defer apiStream.StoreRequest()
		}

		data.GetMetricManager().UpdateMetricsForAPICall(apiStream)

		flowActions := &stream_config.StreamActions{
			Request: &stream_config.RequestStream{},
		}
		if err = runner.RunFlow(data.stream, apiStream, flowActions); err == nil {
			actions = getSPOEReqActions(args, flowActions.Request.Actions)
		}
		data.GetMetricManager().UpdateMetricsForFlow(data.stream)

	} else {
		// This is a patch for the legacy mode body parsing
		args.Body = bytes.NewBuffer(args.RawBody).String()

		policiesData := data.GetTxnPoliciesAccessor().GetTxnPoliciesData(config.TxnID(args.ID))
		log.Trace().Msgf("On request policies: %+v\n", policiesData)
		actions, err = runner.DispatchOnRequest(
			args,
			&policiesData.EndpointPolicyTree,
			&policiesData.Config,
			data.policiesServices,
			data.diagnosisWorker,
		)
	}
	log.Trace().Str("request-id", args.ID).Msg("On request finished")
	return actions, err
}

func processResponse(msg *message.Message, data *HandlingDataManager) (action.Actions, error) {
	var actions action.Actions
	var err error
	args := readResponseArgs(msg)
	log.Trace().Msgf("On response args: %+v\n", args)
	if data.IsStreamsEnabled() {
		apiStream := stream_types.NewResponseAPIStream(args, sharedState)
		if args.IsFullResponse() {
			defer apiStream.DiscardRequest()
		}

		data.GetMetricManager().UpdateMetricsForAPICall(apiStream)

		flowActions := &stream_config.StreamActions{
			Response: &stream_config.ResponseStream{},
		}
		if err = runner.RunFlow(data.stream, apiStream, flowActions); err == nil {
			actions = getSPOERespActions(args, flowActions.Response.Actions)
		}
		data.GetMetricManager().UpdateMetricsForFlow(data.stream)

	} else {
		// This is a patch for the legacy mode body parsing
		args.Body = bytes.NewBuffer(args.RawBody).String()

		policiesData := data.GetTxnPoliciesAccessor().GetTxnPoliciesData(config.TxnID(args.ID))
		log.Trace().Msgf("On response policies: %+v\n", policiesData)
		actions, err = runner.DispatchOnResponse(
			args,
			&policiesData.EndpointPolicyTree,
			&policiesData.Config.Global,
			data.policiesServices,
			data.diagnosisWorker,
		)
	}
	log.Trace().Str("response-id", args.ID).Msg("On response finished")
	return actions, err
}

func extractArg[T any](key string, arg *kv.KV) T {
	var res T
	rawValue, found := arg.Get(key)
	if !found {
		return res
	}

	if value, valid := rawValue.(T); !valid {
		log.Trace().
			Msgf("Could not parse value %v (type: %T) from argument %v as type %T",
				rawValue, rawValue, key, res)
	} else {
		res = value
	}

	return res
}

func readRequestArgs(msg *message.Message) lunar_messages.OnRequest {
	onRequest := lunar_messages.OnRequest{LunarName: msg.Name} //nolint:exhaustruct
	onRequest.ID = extractArg[string]("id", msg.KV)
	onRequest.SequenceID = extractArg[string]("sequence_id", msg.KV)
	onRequest.Method = extractArg[string]("method", msg.KV)
	onRequest.Scheme = extractArg[string]("scheme", msg.KV)
	onRequest.URL = extractArg[string]("url", msg.KV)
	onRequest.Path = extractArg[string]("path", msg.KV)
	onRequest.Query = extractArg[string]("query", msg.KV)
	headerStr := extractArg[string]("headers", msg.KV)
	onRequest.Headers = utils.ParseHeaders(&headerStr)
	onRequest.RawBody = extractArg[[]byte]("body", msg.KV)
	onRequest.Time = context_manager.Get().GetClock().Now()
	return onRequest
}

func readResponseArgs(msg *message.Message) lunar_messages.OnResponse {
	onResponse := lunar_messages.OnResponse{LunarName: msg.Name} //nolint:exhaustruct
	onResponse.ID = extractArg[string]("id", msg.KV)
	onResponse.SequenceID = extractArg[string]("sequence_id", msg.KV)
	onResponse.Method = extractArg[string]("method", msg.KV)
	onResponse.URL = extractArg[string]("url", msg.KV)
	statusINT64 := extractArg[int64]("status", msg.KV)
	onResponse.Status = int(statusINT64)
	headerStr := extractArg[string]("headers", msg.KV)
	onResponse.Headers = utils.ParseHeaders(&headerStr)
	onResponse.RawBody = extractArg[[]byte]("body", msg.KV)
	onResponse.Time = context_manager.Get().GetClock().Now()
	return onResponse
}
