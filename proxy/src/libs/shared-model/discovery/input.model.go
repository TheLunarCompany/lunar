package shareddiscovery

type KnownEndpoints struct {
	Endpoints []Endpoint `yaml:"endpoints"`
}

type Endpoint struct {
	Method string `json:"method" yaml:"method"`
	URL    string `json:"url"    yaml:"url"`
}

type Count int

type EndpointAgg struct {
	MinTime int64
	MaxTime int64

	Count                Count
	StatusCodes          map[int]Count
	AverageDuration      float32 // round trip time from proxy to provider
	AverageTotalDuration float32 // total duration (spoe time + provider time)
}

type EndpointMapping map[Endpoint]EndpointAgg

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
