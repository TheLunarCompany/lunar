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
		Consumers: utils.Combine[utils.Map[string, EndpointMapping]](
			aggA.Consumers,
			aggB.Consumers,
		),
	}
}

// TODO: this is a copy of the Combine method for utils.Map[K, V]
// (found in proxy/src/services/aggregation-output-plugin/utils/combine.go)
// Ideally, we'd find a way to reuse that code properly.
// This fix was introduced after stack overflow incidents in the
// previous implementation.
func (aggA EndpointMapping) Combine(aggB EndpointMapping) EndpointMapping {
	res := make(EndpointMapping)

	for aKey, aValue := range aggA {
		res[aKey] = aValue
	}

	for bKey, bValue := range aggB {
		aValue, keyExists := res[bKey]
		if !keyExists {
			res[bKey] = bValue
			continue
		}
		res[bKey] = aValue.Combine(bValue)
	}

	return res
}

func (aggA InterceptorAgg) Combine(aggB InterceptorAgg) InterceptorAgg {
	return InterceptorAgg{Timestamp: utils.Max(aggA.Timestamp, aggB.Timestamp)}
}
