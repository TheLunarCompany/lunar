//go:build pro

package handlers

import (
	"net/http"

	stream_types "lunar/engine/streams/types"
)

type (
	OnAsyncRetrieveFunc func(*OnRetrieve) *OnResponse
	OnAsyncRegisterFunc func(*OnRegister) error
	OnResponseState     int64
)

const (
	ResponseNotFound OnResponseState = iota
	ResponsePending
	ResponseProcessing
	ResponseCompleted
	ResponseError
)

type OnResponse struct {
	Response *stream_types.OnResponse
	Msg      string
	State    OnResponseState
}

type OnRetrieve struct {
	Request *http.Request
	SeqID   string
}

type OnRegister struct {
	Request *http.Request
}
