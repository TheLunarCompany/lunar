package streamconfig

type (
	RequestStream  struct{}
	ResponseStream struct{}
)

type StreamI interface {
	GetRequestStream() *RequestStream
	GetResponseStream() *ResponseStream
}
