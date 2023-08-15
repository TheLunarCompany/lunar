package actions

import (
	"lunar/engine/messages"
	"lunar/engine/utils"
	sharedActions "lunar/shared-model/actions"

	spoe "github.com/TheLunarCompany/haproxy-spoe-go"
)

const (
	ReturnEarlyResponseActionName = "return_early_response"
	StatusCodeActionName          = "status_code"
	ResponseBodyActionName        = "response_body"

	ModifyRequestActionName  = "modify_request"
	RequestHeadersActionName = "request_headers"

	RequestRunResultName = "request_run_result"
)

// EarlyResponseAction
func (action *EarlyResponseAction) ReqToSpoeActions() []spoe.Action {
	actions := []spoe.Action{
		spoe.ActionSetVar{
			Name:  ReturnEarlyResponseActionName,
			Scope: spoe.VarScopeTransaction,
			Value: true,
		},
		spoe.ActionSetVar{
			Name:  StatusCodeActionName,
			Scope: spoe.VarScopeTransaction,
			Value: action.Status,
		},
		spoe.ActionSetVar{
			Name:  ResponseBodyActionName,
			Scope: spoe.VarScopeTransaction,
			Value: []byte(action.Body),
		},
		spoe.ActionSetVar{
			Name:  ResponseHeadersActionName,
			Scope: spoe.VarScopeTransaction,
			Value: utils.DumpHeaders(action.Headers),
		},
	}

	return actions
}

func (*EarlyResponseAction) ReqRunResult() sharedActions.RemedyReqRunResult {
	return sharedActions.ReqObtainedResponse
}

func (*EarlyResponseAction) EnsureRequestIsUpdated(_ *messages.OnRequest) {
}

// ModifyRequestAction
func (action *ModifyRequestAction) ReqToSpoeActions() []spoe.Action {
	actions := []spoe.Action{
		spoe.ActionSetVar{
			Name:  ModifyRequestActionName,
			Scope: spoe.VarScopeRequest,
			Value: true,
		},
		spoe.ActionSetVar{
			Name:  RequestHeadersActionName,
			Scope: spoe.VarScopeRequest,
			Value: utils.DumpHeaders(action.HeadersToSet),
		},
	}
	return actions
}

func (action *ModifyRequestAction) ReqRunResult() sharedActions.RemedyReqRunResult { //nolint:lll
	return sharedActions.ReqModifiedRequest
}

func (action *ModifyRequestAction) EnsureRequestIsUpdated(
	onRequest *messages.OnRequest,
) {
	for name, value := range action.HeadersToSet {
		onRequest.Headers[name] = value
	}
}
