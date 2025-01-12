package processors

import (
	processorFilter "lunar/engine/streams/processors/filter-processor"
	processorGenerateResponse "lunar/engine/streams/processors/generate-response"
	processorLimiter "lunar/engine/streams/processors/limiter"
	processorMock "lunar/engine/streams/processors/mock"
	processorQueue "lunar/engine/streams/processors/queue"
	processorQuotaDec "lunar/engine/streams/processors/quota-processor-dec"
	processorQuotaInc "lunar/engine/streams/processors/quota-processor-inc"
	processorRetry "lunar/engine/streams/processors/retry"
	processorUserDefinedMetrics "lunar/engine/streams/processors/user-defined-metrics"
	streamTypes "lunar/engine/streams/types"
)

type ProcessorFactory func(*streamTypes.ProcessorMetaData) (streamTypes.Processor, error)

var internalProcessorRegistry map[string]ProcessorFactory

func init() {
	internalProcessorRegistry = map[string]ProcessorFactory{
		"MockProcessor":      processorMock.NewProcessor,
		"Retry":              processorRetry.NewProcessor,
		"Filter":             processorFilter.NewProcessor,
		"Limiter":            processorLimiter.NewProcessor,
		"GenerateResponse":   processorGenerateResponse.NewProcessor,
		"Queue":              processorQueue.NewProcessor,
		"QuotaProcessorInc":  processorQuotaInc.NewProcessor,
		"QuotaProcessorDec":  processorQuotaDec.NewProcessor,
		"UserDefinedMetrics": processorUserDefinedMetrics.NewProcessor,
	}
}
