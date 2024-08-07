package processors

import (
	processorgenerateresponse "lunar/engine/streams/processors/generate-response"
	processorlimiter "lunar/engine/streams/processors/limiter"
	processormock "lunar/engine/streams/processors/mock"
	processorqueue "lunar/engine/streams/processors/queue"
	processorquotadec "lunar/engine/streams/processors/quota-processor-dec"
	processorquotainc "lunar/engine/streams/processors/quota-processor-inc"
	streamtypes "lunar/engine/streams/types"
)

type ProcessorFactory func(*streamtypes.ProcessorMetaData) (streamtypes.Processor, error)

var internalProcessorRegistry map[string]ProcessorFactory

func init() {
	internalProcessorRegistry = map[string]ProcessorFactory{
		"MockProcessor":     processormock.NewProcessor,
		"Limiter":           processorlimiter.NewProcessor,
		"GenerateResponse":  processorgenerateresponse.NewProcessor,
		"Queue":             processorqueue.NewProcessor,
		"QuotaProcessorInc": processorquotainc.NewProcessor,
		"QuotaProcessorDec": processorquotadec.NewProcessor,
	}
}
