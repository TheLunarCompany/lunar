package actions

import (
	lunarMessages "lunar/engine/messages"
	sharedActions "lunar/shared-model/actions"

	"github.com/negasus/haproxy-spoe-go/action"
)

type ReqLunarAction interface {
	ReqToSpoeActions() action.Actions
	ReqRunResult() sharedActions.RemedyReqRunResult
	ReqPrioritize(ReqLunarAction) ReqLunarAction
	EnsureRequestIsUpdated(onRequest *lunarMessages.OnRequest)
	IsEarlyReturnType() bool
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
	Host         string
	Path         string
	QueryParams  string
	Body         string
}

// This action will change original request headers before request is directed to the API provider
type ModifyHeadersAction struct {
	HeadersToSet map[string]string
}

type GenerateRequestAction struct {
	HeadersToSet    map[string]string
	HeadersToRemove []string
	Body            string
}
