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
		Labels  map[string]sharedDiscovery.APICallsMetric // key is hash of APICallMetric
		Metrics map[string]int64                          // key is hash of APICallMetric
	}
)

func (md *APICallMetricData) UpdateMetric(accessLog AccessLog) {
	metric := sharedDiscovery.APICallsMetric{
		StatusCode:  accessLog.StatusCode,
		Method:      accessLog.Method,
		Host:        accessLog.Host,
		URL:         accessLog.URL,
		ConsumerTag: accessLog.ConsumerTag,
	}

	hash := metric.Hash()
	md.Metrics[hash]++
	md.Labels[hash] = metric
}

func (agg EndpointAgg) totalDuration() float32 {
	return agg.AverageDuration * float32(agg.Count)
}
