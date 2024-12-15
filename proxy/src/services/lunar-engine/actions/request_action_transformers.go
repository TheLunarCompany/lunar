package actions

import (
	lunarMessages "lunar/engine/messages"
	"lunar/engine/utils"
	sharedActions "lunar/shared-model/actions"
	"strings"

	"github.com/negasus/haproxy-spoe-go/action"
)

const (
	ReturnEarlyResponseActionName = "return_early_response"
	StatusCodeActionName          = "status_code"
	ResponseBodyActionName        = "response_body"

	ModifyRequestActionName   = "modify_request"
	GenerateRequestActionName = "generate_request"
	RequestHeadersActionName  = "request_headers"
	RequestBodyActionName     = "request_body"

	RequestRunResultName = "request_run_result"
)

// EarlyResponseAction
func (a *EarlyResponseAction) ReqToSpoeActions() action.Actions {
	actions := action.Actions{}
	actions.SetVar(action.ScopeTransaction, ReturnEarlyResponseActionName, true)
	actions.SetVar(action.ScopeTransaction, StatusCodeActionName, a.Status)
	actions.SetVar(action.ScopeTransaction, ResponseBodyActionName, []byte(a.Body))
	actions.SetVar(action.ScopeTransaction, ResponseHeadersActionName, utils.DumpHeaders(a.Headers))
	return actions
}

func (*EarlyResponseAction) ReqRunResult() sharedActions.RemedyReqRunResult {
	return sharedActions.ReqObtainedResponse
}

func (*EarlyResponseAction) EnsureRequestIsUpdated(_ *lunarMessages.OnRequest) {
}

// ModifyRequestAction
func (lunarAction *ModifyRequestAction) ReqToSpoeActions() action.Actions {
	actions := action.Actions{}
	actions.SetVar(action.ScopeRequest, ModifyRequestActionName, true)
	actions.SetVar(action.ScopeRequest,
		RequestHeadersActionName, utils.DumpHeaders(lunarAction.HeadersToSet))
	return actions
}

func (lunarAction *ModifyRequestAction) ReqRunResult() sharedActions.RemedyReqRunResult {
	return sharedActions.ReqModifiedRequest
}

func (lunarAction *ModifyRequestAction) EnsureRequestIsUpdated(
	onRequest *lunarMessages.OnRequest,
) {
	for name, value := range lunarAction.HeadersToSet {
		onRequest.Headers[name] = value
	}
}

func (lunarAction *GenerateRequestAction) ReqToSpoeActions() action.Actions {
	actions := action.Actions{}
	actions.SetVar(action.ScopeRequest, GenerateRequestActionName, true)
	actions.SetVar(action.ScopeRequest,
		RequestHeadersActionName, utils.DumpHeaders(lunarAction.HeadersToSet))
	actions.SetVar(action.ScopeRequest,
		RequestBodyActionName, []byte(lunarAction.Body))
	return actions
}

func (lunarAction *GenerateRequestAction) ReqRunResult() sharedActions.RemedyReqRunResult {
	return sharedActions.ReqGenerateRequest
}

func (lunarAction *GenerateRequestAction) EnsureRequestIsUpdated(
	onRequest *lunarMessages.OnRequest,
) {
	for name, value := range onRequest.Headers {
		delete(onRequest.Headers, name)
		onRequest.Headers[strings.ToLower(name)] = value
	}

	for name, value := range lunarAction.HeadersToSet {
		onRequest.Headers[strings.ToLower(name)] = value
	}

	for _, value := range lunarAction.HeadersToRemove {
		delete(onRequest.Headers, value)
	}
}
