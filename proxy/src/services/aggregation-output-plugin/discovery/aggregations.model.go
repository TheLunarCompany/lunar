package discovery

import (
	"lunar/aggregation-plugin/common"
	shared_discovery "lunar/shared-model/discovery"
)

type (
	AccessLog common.AccessLog
)

type FilterResult struct {
	*shared_discovery.OnError
	AccessLogs []AccessLog
}

type (
	Agg struct {
		Interceptors map[common.Interceptor]InterceptorAgg
		Endpoints    map[shared_discovery.Endpoint]shared_discovery.EndpointAgg
		Consumers    map[string]shared_discovery.EndpointMapping
	}

	InterceptorAgg struct {
		Timestamp int64
	}
)
