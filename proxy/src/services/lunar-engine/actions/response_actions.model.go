package actions

import (
	"lunar/engine/messages"
	sharedActions "lunar/shared-model/actions"

	spoe "github.com/TheLunarCompany/haproxy-spoe-go"
)

type RespLunarAction interface {
	RespToSpoeActions() []spoe.Action
	RespRunResult() sharedActions.RemedyRespRunResult
	RespPrioritize(RespLunarAction) RespLunarAction
	EnsureResponseIsUpdated(onResponse *messages.OnResponse)
}

// This file contains the possible actions a remedy plugin can apply.
// Returning an action might change the course of handling
// the API call in various way, whether before calling the actual provider
// or after receiving an actual response from it.

// Response Actions
// This action will change the actual API response from the provider before
// it is returned to the user
type ModifyResponseAction struct {
	HeadersToSet map[string]string
}
