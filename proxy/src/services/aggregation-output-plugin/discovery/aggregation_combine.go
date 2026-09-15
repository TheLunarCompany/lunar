package discovery

import (
	"lunar/aggregation-plugin/common"
	sharedDiscovery "lunar/shared-model/discovery"
	"lunar/toolkit-core/utils"
)

func CombineAggregation(a, b Agg) Agg {
	return a.Combine(b)
}

func (aggA Agg) Combine(aggB Agg) Agg {
	return Agg{
		Interceptors: utils.Combine[utils.Map[common.Interceptor, InterceptorAgg]](
			aggA.Interceptors,
			aggB.Interceptors,
		),
		Endpoints: utils.Combine[utils.Map[sharedDiscovery.Endpoint, sharedDiscovery.EndpointAgg]](
			aggA.Endpoints,
			aggB.Endpoints,
		),
		Consumers: utils.Combine[utils.Map[string, sharedDiscovery.EndpointMapping]](
			aggA.Consumers,
			aggB.Consumers,
		),
	}
}

func (aggA InterceptorAgg) Combine(aggB InterceptorAgg) InterceptorAgg {
	return InterceptorAgg{Timestamp: utils.Max(aggA.Timestamp, aggB.Timestamp)}
}
