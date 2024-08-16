package streamconfig

import "lunar/engine/actions"

type (
	StreamActions struct {
		Request  *RequestStream
		Response *ResponseStream
	}

	RequestStream struct {
		Actions []actions.ReqLunarAction
	}

	ResponseStream struct {
		Actions []actions.RespLunarAction
	}
)
