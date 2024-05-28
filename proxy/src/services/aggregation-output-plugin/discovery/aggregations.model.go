package discovery

import (
	"lunar/aggregation-plugin/common"
)

type AccessLog common.AccessLog

type (
	Count int

	Agg struct {
		Interceptors map[common.Interceptor]InterceptorAgg
		Endpoints    map[common.Endpoint]EndpointAgg
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
)

func (agg EndpointAgg) totalDuration() float32 {
	return agg.AverageDuration * float32(agg.Count)
}
