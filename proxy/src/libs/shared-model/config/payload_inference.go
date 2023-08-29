package config

const (
	ResponseHeadersPayload = "response_headers"
	UndefinedPayload       = "undefined"
)

func payloadLiteralToEnum(payloadLiteral payloadLiteral) Payload {
	switch payloadLiteral {
	case ResponseHeadersPayload:
		return PayloadResponseHeaders
	default:
		return PayloadUndefined
	}
}

func (counter *Counter) PayloadType() Payload {
	return payloadLiteralToEnum(counter.Payload)
}

func (payload Payload) String() string {
	var res string
	switch payload {
	case PayloadResponseHeaders:
		res = ResponseHeadersPayload
	case PayloadUndefined:
		res = UndefinedPayload
	}
	return res
}
