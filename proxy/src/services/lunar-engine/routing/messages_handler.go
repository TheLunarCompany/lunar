package routing

import (
	"bytes"
	"lunar/engine/actions"
	"lunar/engine/config"
	lunarMessages "lunar/engine/messages"
	"lunar/engine/runner"
	streamconfig "lunar/engine/streams/config"
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils"
	contextmanager "lunar/toolkit-core/context-manager"
	"lunar/toolkit-core/otel"
	"reflect"

	"github.com/negasus/haproxy-spoe-go/action"
	"github.com/negasus/haproxy-spoe-go/message"
	"github.com/negasus/haproxy-spoe-go/payload/kv"
	"github.com/negasus/haproxy-spoe-go/request"
	"github.com/rs/zerolog/log"
)

type MessageHandler func(msgs *request.Request)

func Handler(data *HandlingDataManager) MessageHandler {
	data.RunDiagnosisWorker()
	ctxMng := contextmanager.Get()

	handlerInner := func(req *request.Request) {
		var actions action.Actions
		if requestMessage, err := req.Messages.GetByName("lunar-on-request"); err == nil {
			_, span := otel.Tracer(ctxMng.GetContext(), "routing#lunarOnRequestMessage")
			defer span.End()
			actions, err = processRequest(requestMessage, data)
			if err != nil {
				log.Error().Err(err).Msg("Error processing request")
				return
			}
		}
		if responseMessage, err := req.Messages.GetByName("lunar-on-response"); err == nil {
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

func getSPOEReqActions(
	args lunarMessages.OnRequest,
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

func getSPOERespActions(
	args lunarMessages.OnResponse,
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
		apiStream := streamtypes.NewRequestAPIStream(args)
		data.GetMetricManager().UpdateMetricsForAPICall(apiStream)

		flowActions := &streamconfig.StreamActions{
			Request: &streamconfig.RequestStream{},
		}
		if err = runner.RunFlow(data.stream, apiStream, flowActions); err == nil {
			actions = getSPOEReqActions(args, flowActions.Request.Actions)
		}
		data.GetMetricManager().UpdateMetricsForFlow(data.stream)

	} else {
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
		apiStream := streamtypes.NewResponseAPIStream(args)
		data.GetMetricManager().UpdateMetricsForAPICall(apiStream)

		flowActions := &streamconfig.StreamActions{
			Response: &streamconfig.ResponseStream{},
		}
		if err = runner.RunFlow(data.stream, apiStream, flowActions); err == nil {
			actions = getSPOERespActions(args, flowActions.Response.Actions)
		}
		data.GetMetricManager().UpdateMetricsForFlow(data.stream)

	} else {
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

func readRequestArgs(msg *message.Message) lunarMessages.OnRequest {
	onRequest := lunarMessages.OnRequest{} //nolint:exhaustruct
	onRequest.ID = extractArg[string]("id", msg.KV)
	onRequest.SequenceID = extractArg[string]("sequence_id", msg.KV)
	onRequest.Method = extractArg[string]("method", msg.KV)
	onRequest.Scheme = extractArg[string]("scheme", msg.KV)
	onRequest.URL = extractArg[string]("url", msg.KV)
	onRequest.Path = extractArg[string]("path", msg.KV)
	onRequest.Query = extractArg[string]("query", msg.KV)
	headerStr := extractArg[string]("headers", msg.KV)
	onRequest.Headers = utils.ParseHeaders(&headerStr)
	onRequest.Body = bytes.NewBuffer(extractArg[[]byte]("body", msg.KV)).String()
	onRequest.Time = contextmanager.Get().GetClock().Now()
	return onRequest
}

func readResponseArgs(msg *message.Message) lunarMessages.OnResponse {
	onResponse := lunarMessages.OnResponse{} //nolint:exhaustruct
	onResponse.ID = extractArg[string]("id", msg.KV)
	onResponse.SequenceID = extractArg[string]("sequence_id", msg.KV)
	onResponse.Method = extractArg[string]("method", msg.KV)
	onResponse.URL = extractArg[string]("url", msg.KV)
	statusINT64 := extractArg[int64]("status", msg.KV)
	onResponse.Status = int(statusINT64)
	headerStr := extractArg[string]("headers", msg.KV)
	onResponse.Headers = utils.ParseHeaders(&headerStr)
	onResponse.Body = bytes.NewBuffer(extractArg[[]byte]("body", msg.KV)).String()
	onResponse.Time = contextmanager.Get().GetClock().Now()
	return onResponse
}
