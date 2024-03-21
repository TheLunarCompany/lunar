package streamconfig

type (
	RequestStream  struct{}
	ResponseStream struct{}
)

type Stream interface {
	GetRequestStream() *RequestStream
	GetResponseStream() *ResponseStream
}
