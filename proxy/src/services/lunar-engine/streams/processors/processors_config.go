package processors

import (
	processor_async_queue "lunar/engine/streams/processors/async-queue"
	processor_count_llm_tokens "lunar/engine/streams/processors/count-llm-tokens"
	processor_custom_script "lunar/engine/streams/processors/custom-script"
	processor_filter "lunar/engine/streams/processors/filter-processor"
	processor_generate_response "lunar/engine/streams/processors/generate-response"
	processor_har_collector "lunar/engine/streams/processors/har-collector"
	processor_limiter "lunar/engine/streams/processors/limiter"
	processor_mock "lunar/engine/streams/processors/mock"
	processor_queue "lunar/engine/streams/processors/queue"
	processor_quota_dec "lunar/engine/streams/processors/quota-processor-dec"
	processor_quota_inc "lunar/engine/streams/processors/quota-processor-inc"
	processor_read_cache "lunar/engine/streams/processors/read-cache"
	processor_retry "lunar/engine/streams/processors/retry"
	processor_transform_api_call "lunar/engine/streams/processors/transform-api-call"
	processor_user_defined_metrics "lunar/engine/streams/processors/user-defined-metrics"
	processor_user_defined_traces "lunar/engine/streams/processors/user-defined-traces"
	processor_write_cache "lunar/engine/streams/processors/write-cache"
	stream_types "lunar/engine/streams/types"
)

type ProcessorFactory func(*stream_types.ProcessorMetaData) (stream_types.ProcessorI, error)

var internalProcessorRegistry map[string]ProcessorFactory

func init() {
	internalProcessorRegistry = map[string]ProcessorFactory{
		"MockProcessor":      processor_mock.NewProcessor,
		"Retry":              processor_retry.NewProcessor,
		"Filter":             processor_filter.NewProcessor,
		"Limiter":            processor_limiter.NewProcessor,
		"GenerateResponse":   processor_generate_response.NewProcessor,
		"AsyncQueue":         processor_async_queue.NewProcessor,
		"Queue":              processor_queue.NewProcessor,
		"QuotaProcessorInc":  processor_quota_inc.NewProcessor,
		"QuotaProcessorDec":  processor_quota_dec.NewProcessor,
		"UserDefinedMetrics": processor_user_defined_metrics.NewProcessor,
		"CountLLMTokens":     processor_count_llm_tokens.NewProcessor,
		"HARCollector":       processor_har_collector.NewProcessor,
		"ReadCache":          processor_read_cache.NewProcessor,
		"WriteCache":         processor_write_cache.NewProcessor,
		"TransformAPICall":   processor_transform_api_call.NewProcessor,
		"CustomScript":       processor_custom_script.NewProcessor,
		"UserDefinedTraces":  processor_user_defined_traces.NewProcessor,
	}
}
