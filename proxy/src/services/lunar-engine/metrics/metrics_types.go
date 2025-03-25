package metrics

type (
	Metric     string
	MetricType int
)

const (
	Int64ObservableCounter MetricType = iota
	Float64ObservableCounter
	Int64ObservableUpDownCounter
	Float64ObservableUpDownCounter
	Int64ObservableGauge
	Float64ObservableGauge
	Float64Histogram
)

const (
	MetricPrefix = "lunar_"

	FlowName     = "flow_name"
	ProcessorKey = "processor_key"
	HTTPMethod   = "http_method"
	URL          = "url"
	Host         = "host"
	StatusCode   = "status_code"
	ConsumerTag  = "consumer_tag"

	APICallCountMetric              Metric = "api_call_count"
	APICallSizeMetric               Metric = "api_call_size"
	TransactionDuration             Metric = "transaction_duration"
	ProviderTransactionDuration     Metric = "provider_transaction_duration"
	ActiveFlowsMetric               Metric = "active_flows"
	FlowsInvocationsMetric          Metric = "flow_invocations"
	RequestsThroughFlowsMetric      Metric = "requests_through_flows"
	AvgFlowExecutionTimeMetric      Metric = "avg_flow_execution_time"
	AvgProcessorExecutionTimeMetric Metric = "avg_processor_execution_time"

	CustomMetric Metric = "custom"

	HeaderConsumerTag = "x-lunar-consumer-tag"
)

// As we not including the lunar prefix in all metrics,
// we need to have a way to validate if a metric is a lunar metric
var labelsToInclude = []string{
	"api_call_count",
	"api_call_size",
	"transaction_duration",
	"provider_transaction_duration",
	"active_flows",
	"flow_invocations",
	"requests_through_flows",
	"avg_flow_execution_time",
	"avg_processor_execution_time",
}

// metrics that based on access logs and handled by their own managers that parse discover file
var accessLogBasedMetrics = map[Metric]struct{}{
	APICallCountMetric:          {},
	TransactionDuration:         {},
	ProviderTransactionDuration: {},
}

var metricsObservableRegistry = map[Metric]MetricType{
	APICallCountMetric:              Int64ObservableCounter,
	APICallSizeMetric:               Float64ObservableGauge,
	ActiveFlowsMetric:               Int64ObservableUpDownCounter,
	FlowsInvocationsMetric:          Int64ObservableCounter,
	RequestsThroughFlowsMetric:      Int64ObservableCounter,
	AvgFlowExecutionTimeMetric:      Float64ObservableGauge,
	AvgProcessorExecutionTimeMetric: Float64ObservableGauge,
}
