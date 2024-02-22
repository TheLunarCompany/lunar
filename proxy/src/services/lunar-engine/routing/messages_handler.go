package routing

import (
	"bytes"
	"context"
	"lunar/engine/config"
	"lunar/engine/messages"
	"lunar/engine/runner"
	"lunar/engine/services"
	"lunar/engine/utils"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/otel"

	spoe "github.com/TheLunarCompany/haproxy-spoe-go"
	"github.com/rs/zerolog/log"
)

const (
	lunarOnRequestMessage  = "lunar-on-request"
	lunarOnResponseMessage = "lunar-on-response"
)

func Handler(
	ctx context.Context,
	policiesAccessor config.PoliciesAccessor,
	services *services.Services,
	diagnosisWorker *runner.DiagnosisWorker,
	clock clock.Clock,
) func(msgs *spoe.MessageIterator) ([]spoe.Action, error) {
	diagnosisWorker.Run(
		policiesAccessor,
		&services.Diagnosis,
		&services.Exporters,
	)

	handlerInner := func(messages *spoe.MessageIterator) ([]spoe.Action, error) {
		var actions []spoe.Action
		var err error
		for messages.Next() {
			message := messages.Message
			switch message.Name {
			case lunarOnRequestMessage:
				_, span := otel.Tracer(ctx, "routing#lunarOnRequestMessage")

				args := readRequestArgs(message.Args, clock)
				policiesData := policiesAccessor.GetTxnPoliciesData(
					config.TxnID(args.ID),
				)
				log.Trace().Msgf("On request args: %+v\n", args)
				log.Trace().Msgf("On request policies: %+v\n", policiesData)
				actions, err = runner.DispatchOnRequest(
					args,
					&policiesData.EndpointPolicyTree,
					&policiesData.Config,
					services,
					diagnosisWorker,
				)
				log.Trace().
					Str("request-id", args.ID).
					Msg("On request finished")

				span.End()
			case lunarOnResponseMessage:
				_, span := otel.Tracer(ctx, "routing#lunarOnResponseMessage")

				args := readResponseArgs(message.Args, clock)
				policiesData := policiesAccessor.GetTxnPoliciesData(
					config.TxnID(args.ID),
				)
				log.Trace().Msgf("On response args: %+v\n", args)
				log.Trace().Msgf("On response policies: %+v\n", policiesData)
				actions, err = runner.DispatchOnResponse(
					args,
					&policiesData.EndpointPolicyTree,
					&policiesData.Config.Global,
					services,
					diagnosisWorker,
				)

				log.Trace().
					Str("response-id", args.ID).
					Msg("On response finished")

				span.End()
			}
		}

		return actions, err
	}

	return handlerInner
}

func extractArg[T any](arg *spoe.Arg) T {
	var res T

	if arg.Value == nil {
		return res
	}

	if value, valid := arg.Value.(T); !valid {
		log.Error().
			Msgf("Could not parse value %v (type: %T) from argument %v as type %T",
				value, value, arg.Name, res)
	} else {
		res = value
	}

	return res
}

func readRequestArgs(args *spoe.ArgIterator,
	clock clock.Clock,
) messages.OnRequest {
	//nolint:exhaustruct
	onRequest := messages.OnRequest{}
	onRequest.Time = clock.Now()

	for args.Next() {
		arg := args.Arg
		switch arg.Name {
		case "id":
			onRequest.ID = extractArg[string](&arg)
		case "sequence_id":
			onRequest.SequenceID = extractArg[string](&arg)
		case "method":
			onRequest.Method = extractArg[string](&arg)
		case "scheme":
			onRequest.Scheme = extractArg[string](&arg)
		case "url":
			onRequest.URL = extractArg[string](&arg)
		case "path":
			onRequest.Path = extractArg[string](&arg)
		case "query":
			onRequest.Query = extractArg[string](&arg)
		case "headers":
			rawValue := extractArg[string](&arg)
			onRequest.Headers = utils.ParseHeaders(&rawValue)
		case "body":
			rawValue := extractArg[[]byte](&arg)
			onRequest.Body = bytes.NewBuffer(rawValue).String()
		}
	}
	return onRequest
}

func readResponseArgs(args *spoe.ArgIterator,
	clock clock.Clock,
) messages.OnResponse {
	//nolint:exhaustruct
	onResponse := messages.OnResponse{}
	onResponse.Time = clock.Now()

	for args.Next() {
		arg := args.Arg

		switch arg.Name {
		case "id":
			value := extractArg[string](&arg)
			onResponse.ID = value
		case "sequence_id":
			value := extractArg[string](&arg)
			onResponse.SequenceID = value
		case "method":
			value := extractArg[string](&arg)
			onResponse.Method = value
		case "url":
			value := extractArg[string](&arg)
			onResponse.URL = value
		case "status":
			value := extractArg[int](&arg)
			onResponse.Status = value
		case "headers":
			rawValue := extractArg[string](&arg)
			onResponse.Headers = utils.ParseHeaders(&rawValue)
		case "body":
			rawValue := extractArg[[]byte](&arg)
			onResponse.Body = bytes.NewBuffer(rawValue).String()
		}
	}

	return onResponse
}
