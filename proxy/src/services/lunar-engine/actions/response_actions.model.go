package actions

import (
	lunarMessages "lunar/engine/messages"
	sharedActions "lunar/shared-model/actions"

	"github.com/negasus/haproxy-spoe-go/action"
)

type RespLunarAction interface {
	RespToSpoeActions() action.Actions
	RespRunResult() sharedActions.RemedyRespRunResult
	RespPrioritize(RespLunarAction) RespLunarAction
	EnsureResponseIsUpdated(onResponse *lunarMessages.OnResponse)
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
	Body         string
	Status       int
	IsInternal   bool
}

type RetryRequestAction struct {
	HeadersToSet map[string]string
}
