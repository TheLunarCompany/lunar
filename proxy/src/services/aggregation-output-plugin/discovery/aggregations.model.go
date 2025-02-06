package discovery

import (
	"lunar/aggregation-plugin/common"
	sharedDiscovery "lunar/shared-model/discovery"
)

type AccessLog common.AccessLog

type (
	Agg struct {
		Interceptors map[common.Interceptor]InterceptorAgg
		Endpoints    map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg
		Consumers    map[string]sharedDiscovery.EndpointMapping
	}

	InterceptorAgg struct {
		Timestamp int64
	}
)
