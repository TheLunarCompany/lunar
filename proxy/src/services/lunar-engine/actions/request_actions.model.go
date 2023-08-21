package actions

import (
	"lunar/engine/messages"
	sharedActions "lunar/shared-model/actions"

	spoe "github.com/TheLunarCompany/haproxy-spoe-go"
)

type ReqLunarAction interface {
	ReqToSpoeActions() []spoe.Action
	ReqRunResult() sharedActions.RemedyReqRunResult
	ReqPrioritize(ReqLunarAction) ReqLunarAction
	EnsureRequestIsUpdated(onRequest *messages.OnRequest)
}

// This file contains the possible actions a remedy plugin can apply.
// Returning an action might change the course of handling
// the API call in various way, whether before calling the actual provider
// or after receiving an actual response from it.

// This action will return the supplied status, body and headers as a response
// to the calling client, without ever reaching to the actual API provider.
type EarlyResponseAction struct {
	Status  int
	Body    string
	Headers map[string]string
}

// This action will change the original API request before it is directed to the
// actual API provider
type ModifyRequestAction struct {
	HeadersToSet map[string]string
}
