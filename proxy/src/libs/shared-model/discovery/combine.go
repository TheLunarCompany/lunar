package shareddiscovery

import "lunar/toolkit-core/utils"

func (a Count) Combine(b Count) Count {
	return a + b
}

// Total duration - round trip time from proxy to provider
func (agg EndpointAgg) TotalDuration() float32 {
	return agg.AverageDuration * float32(agg.Count)
}

func (agg EndpointAgg) TotalSpoeAndProviderDuration() float32 {
	return agg.AverageTotalDuration * float32(agg.Count)
}

func (agg EndpointAgg) Combine(aggB EndpointAgg) EndpointAgg {
	count := agg.Count + aggB.Count

	var averageDuration float32
	totalDuration := agg.TotalDuration() + aggB.TotalDuration()
	if count > 0 {
		averageDuration = float32(totalDuration) / float32(count)
	}

	var averageSpoeAndProviderTotalDuration float32
	totalSpoeAndProviderDuration := agg.TotalSpoeAndProviderDuration() +
		aggB.TotalSpoeAndProviderDuration()
	if count > 0 {
		averageSpoeAndProviderTotalDuration = float32(totalSpoeAndProviderDuration) / float32(count)
	}

	return EndpointAgg{
		MinTime: utils.Min(agg.MinTime, aggB.MinTime),
		MaxTime: utils.Max(agg.MaxTime, aggB.MaxTime),
		Count:   count,
		StatusCodes: utils.Combine[utils.Map[int, Count]](
			agg.StatusCodes,
			aggB.StatusCodes,
		),
		AverageDuration:      averageDuration,
		AverageTotalDuration: averageSpoeAndProviderTotalDuration,
	}
}
