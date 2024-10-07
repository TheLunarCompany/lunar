package metrics

type (
	Metric      string
	MetricType  string
	MetricLabel string
)

const (
	Counter       MetricType = "counter"
	UpDownCounter MetricType = "up_down_counter"
	Gauge         MetricType = "gauge"
	Histogram     MetricType = "histogram"
	Custom        MetricType = "custom"

	HTTPMethod  MetricLabel = "http_method"
	URL         MetricLabel = "url"
	StatusCode  MetricLabel = "status_code"
	ConsumerTag MetricLabel = "consumer_tag"

	APICallCountMetric              Metric = "api_call_count"
	APICallSizeMetric               Metric = "api_call_size"
	ActiveFlowsMetric               Metric = "active_flows"
	FlowsInvocationsMetric          Metric = "flow_invocations"
	RequestsThroughFlowsMetric      Metric = "requests_through_flows"
	AvgFlowExecutionTimeMetric      Metric = "avg_flow_execution_time"
	AvgProcessorExecutionTimeMetric Metric = "avg_processor_execution_time"

	CustomMetric Metric = "custom"

	HeaderConsumerTag = "x-lunar-consumer-tag"
)

var (
	apiMetrics = map[Metric]Metric{
		APICallCountMetric: APICallCountMetric,
		APICallSizeMetric:  APICallSizeMetric,
	}

	flowsMetrics = map[Metric]Metric{
		ActiveFlowsMetric:               ActiveFlowsMetric,
		FlowsInvocationsMetric:          FlowsInvocationsMetric,
		RequestsThroughFlowsMetric:      RequestsThroughFlowsMetric,
		AvgFlowExecutionTimeMetric:      AvgFlowExecutionTimeMetric,
		AvgProcessorExecutionTimeMetric: AvgProcessorExecutionTimeMetric,
	}
)
