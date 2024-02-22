package actions

import (
	"lunar/engine/messages"
	"lunar/engine/utils"
	sharedActions "lunar/shared-model/actions"

	spoe "github.com/TheLunarCompany/haproxy-spoe-go"
)

const ModifyResponseActionName = "modify_response"

// ModifyResponseAction
func (action *ModifyResponseAction) RespToSpoeActions() []spoe.Action {
	actions := []spoe.Action{
		spoe.ActionSetVar{
			Name:  ModifyResponseActionName,
			Scope: spoe.VarScopeResponse,
			Value: true,
		},
		spoe.ActionSetVar{
			Name:  ResponseHeadersActionName,
			Scope: spoe.VarScopeResponse,
			Value: utils.DumpHeaders(action.HeadersToSet),
		},
	}

	return actions
}

func (action *ModifyResponseAction) RespRunResult() sharedActions.RemedyRespRunResult {
	return sharedActions.RespModifiedResponse
}

func (action *ModifyResponseAction) EnsureResponseIsUpdated(
	onResponse *messages.OnResponse,
) {
	for name, value := range action.HeadersToSet {
		onResponse.Headers[name] = value
	}
}
