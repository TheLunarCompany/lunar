package discovery

import (
	"lunar/aggregation-plugin/common"
	"lunar/aggregation-plugin/utils"
)

func CombineAggregation(a, b Agg) Agg {
	return a.Combine(b)
}

func (a Count) Combine(b Count) Count {
	return a + b
}

func (aggA Agg) Combine(aggB Agg) Agg {
	return Agg{
		Interceptors: utils.Combine[utils.Map[common.Interceptor, InterceptorAgg]](
			aggA.Interceptors,
			aggB.Interceptors,
		),
		Endpoints: utils.Combine[utils.Map[common.Endpoint, EndpointAgg]](
			aggA.Endpoints,
			aggB.Endpoints,
		),
	}
}

func (aggA InterceptorAgg) Combine(aggB InterceptorAgg) InterceptorAgg {
	return InterceptorAgg{Timestamp: max(aggA.Timestamp,
		aggB.Timestamp)}
}

func (aggA EndpointAgg) Combine(aggB EndpointAgg) EndpointAgg {
	count := aggA.Count + aggB.Count

	var averageDuration float32
	totalDuration := aggA.totalDuration() + aggB.totalDuration()
	if count > 0 {
		averageDuration = float32(totalDuration) / float32(count)
	}

	return EndpointAgg{
		MinTime: min(aggA.MinTime, aggB.MinTime),
		MaxTime: max(aggA.MaxTime, aggB.MaxTime),
		Count:   count,
		StatusCodes: utils.Combine[utils.Map[int, Count]](
			aggA.StatusCodes,
			aggB.StatusCodes,
		),
		AverageDuration: averageDuration,
	}
}

func min(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

func max(a, b int64) int64 {
	if a > b {
		return a
	}
	return b
}
