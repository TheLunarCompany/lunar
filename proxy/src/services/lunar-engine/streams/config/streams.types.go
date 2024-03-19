package streamconfig

import (
	streamfilter "lunar/engine/streams/filter"
	streamflow "lunar/engine/streams/flow"
	streamtypes "lunar/engine/streams/types"
)

type (
	RequestStream  struct{}
	ResponseStream struct{}
)

type Stream interface {
	GetRequestStream() *RequestStream
	GetResponseStream() *ResponseStream
	NewFlow(*streamfilter.Filter) (*streamflow.Flow, error)
	ExecuteFlow(*streamfilter.Filter, *streamtypes.APIStream) error
}
