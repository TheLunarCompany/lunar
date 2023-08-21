package actions

import (
	"lunar/engine/messages"
	sharedActions "lunar/shared-model/actions"

	spoe "github.com/TheLunarCompany/haproxy-spoe-go"
)

const ResponseHeadersActionName = "response_headers"

// NoOpAction

func (*NoOpAction) ReqToSpoeActions() []spoe.Action {
	return []spoe.Action{}
}

func (*NoOpAction) RespToSpoeActions() []spoe.Action {
	return []spoe.Action{}
}

func (*NoOpAction) ReqRunResult() sharedActions.RemedyReqRunResult {
	return sharedActions.ReqNoOp
}

func (*NoOpAction) RespRunResult() sharedActions.RemedyRespRunResult {
	return sharedActions.RespNoOp
}

func (*NoOpAction) EnsureRequestIsUpdated(_ *messages.OnRequest) {
}

func (*NoOpAction) EnsureResponseIsUpdated(_ *messages.OnResponse) {
}
