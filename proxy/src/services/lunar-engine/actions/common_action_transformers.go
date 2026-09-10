package actions

import (
	lunarMessages "lunar/engine/messages"
	sharedActions "lunar/shared-model/actions"

	"github.com/negasus/haproxy-spoe-go/action"
)

const ResponseHeadersActionName = "response_headers"

// NoOpAction

func (*NoOpAction) ReqToSpoeActions() action.Actions {
	return action.Actions{}
}

func (*NoOpAction) RespToSpoeActions() action.Actions {
	return action.Actions{}
}

func (*NoOpAction) ReqRunResult() sharedActions.RemedyReqRunResult {
	return sharedActions.ReqNoOp
}

func (*NoOpAction) RespRunResult() sharedActions.RemedyRespRunResult {
	return sharedActions.RespNoOp
}

func (*NoOpAction) EnsureRequestIsUpdated(_ *lunarMessages.OnRequest) {
}

func (*NoOpAction) EnsureResponseIsUpdated(_ *lunarMessages.OnResponse) {
}
