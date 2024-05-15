package streamconfig

import "lunar/engine/actions"

type (
	RequestStream struct {
		Actions []actions.ReqLunarAction
	}

	ResponseStream struct {
		Actions []actions.RespLunarAction
	}
)

type StreamI interface {
	GetRequestStream() *RequestStream
	GetResponseStream() *ResponseStream
}
