package processors

import (
	processorbasicratelimiter "lunar/engine/streams/processors/basic-rate-limiter"
	processorgenerateresponse "lunar/engine/streams/processors/generate-response"
	processormock "lunar/engine/streams/processors/mock"
	streamtypes "lunar/engine/streams/types"
)

type ProcessorFactory func(*streamtypes.ProcessorMetaData) (streamtypes.Processor, error)

var internalProcessorRegistry map[string]ProcessorFactory

func init() {
	internalProcessorRegistry = map[string]ProcessorFactory{
		"MockProcessor":    processormock.NewProcessor,
		"BasicRateLimiter": processorbasicratelimiter.NewProcessor,
		"GenerateResponse": processorgenerateresponse.NewProcessor,
	}
}
