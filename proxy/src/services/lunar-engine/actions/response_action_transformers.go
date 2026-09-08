package actions

import (
	lunarMessages "lunar/engine/messages"
	"lunar/engine/utils"
	sharedActions "lunar/shared-model/actions"

	"github.com/negasus/haproxy-spoe-go/action"
)

const (
	ModifyResponseActionName = "modify_response"
	RetryRequestActionName   = "retry_request"
	RetryHeadersActionName   = "retry_headers"
)

// ModifyResponseAction
func (lunarAction *ModifyResponseAction) RespToSpoeActions() action.Actions {
	actions := action.Actions{}
	actions.SetVar(action.ScopeResponse, ModifyResponseActionName, true)
	actions.SetVar(action.ScopeResponse, IsInternalActionName, lunarAction.IsInternal)
	actions.SetVar(action.ScopeResponse,
		ResponseHeadersActionName, utils.DumpHeaders(lunarAction.HeadersToSet))
	actions.SetVar(action.ScopeResponse, ResponseBodyActionName, lunarAction.Body)
	actions.SetVar(action.ScopeResponse, WithResponseBodyActionName, lunarAction.Body != "")

	actions.SetVar(action.ScopeResponse, StatusCodeActionName, lunarAction.Status)
	return actions
}

func (lunarAction *ModifyResponseAction) RespRunResult() sharedActions.RemedyRespRunResult {
	return sharedActions.RespModifiedResponse
}

func (lunarAction *ModifyResponseAction) EnsureResponseIsUpdated(
	onResponse *lunarMessages.OnResponse,
) {
	for name, value := range lunarAction.HeadersToSet {
		onResponse.Headers[name] = value
	}
	onResponse.Body = lunarAction.Body
	onResponse.Status = lunarAction.Status
}

func (lunarAction *RetryRequestAction) RespToSpoeActions() action.Actions {
	actions := action.Actions{}
	actions.SetVar(action.ScopeResponse, RetryRequestActionName, true)
	actions.SetVar(action.ScopeResponse, IsInternalActionName, true)
	actions.SetVar(action.ScopeResponse,
		RetryHeadersActionName, utils.DumpHeaders(lunarAction.HeadersToSet))
	return actions
}

func (lunarAction *RetryRequestAction) RespRunResult() sharedActions.RemedyRespRunResult {
	return sharedActions.RespRetryRequest
}

func (lunarAction *RetryRequestAction) EnsureResponseIsUpdated(
	_ *lunarMessages.OnResponse,
) {
}
