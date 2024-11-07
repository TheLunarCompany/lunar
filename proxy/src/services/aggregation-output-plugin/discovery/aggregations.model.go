package discovery

import (
	"lunar/aggregation-plugin/common"
	sharedDiscovery "lunar/shared-model/discovery"
)

type AccessLog common.AccessLog

type (
	Count int

	EndpointMapping map[sharedDiscovery.Endpoint]EndpointAgg

	Agg struct {
		Interceptors map[common.Interceptor]InterceptorAgg
		Endpoints    map[sharedDiscovery.Endpoint]EndpointAgg
		Consumers    map[string]EndpointMapping
	}

	InterceptorAgg struct {
		Timestamp int64
	}

	EndpointAgg struct {
		MinTime int64
		MaxTime int64

		Count           Count
		StatusCodes     map[int]Count
		AverageDuration float32
	}

	APICallMetricData struct {
		supportedLabels []string
		// key is hash of APICallMetric
		Labels  map[string]sharedDiscovery.APICallsMetric
		Metrics map[string]int64
	}
)

func (md *APICallMetricData) UpdateMetric(accessLog AccessLog) {
	metric := sharedDiscovery.APICallsMetric{}
	for _, label := range md.supportedLabels {
		switch label {
		case "status_code":
			metric.StatusCode = accessLog.StatusCode
		case "method":
			metric.Method = accessLog.Method
		case "host":
			metric.Host = accessLog.Host
		case "url":
			metric.URL = accessLog.URL
		case "consumer_tag":
			metric.ConsumerTag = accessLog.ConsumerTag
		}
	}

	hash := metric.Hash()
	md.Metrics[hash]++
	md.Labels[hash] = metric
}

func (agg EndpointAgg) totalDuration() float32 {
	return agg.AverageDuration * float32(agg.Count)
}
