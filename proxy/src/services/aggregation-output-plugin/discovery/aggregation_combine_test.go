package discovery_test

import (
	"lunar/aggregation-plugin/common"
	"lunar/aggregation-plugin/discovery"
	"testing"

	"github.com/stretchr/testify/assert"
)

func endpointAggA() discovery.EndpointAgg {
	return discovery.EndpointAgg{
		MinTime:         1687762338000, // Thu, 26 Jun 2023 06:52:18 GMT
		MaxTime:         1687848738000, // Thu, 27 Jun 2023 06:52:18 GMT
		Count:           2,
		StatusCodes:     map[int]discovery.Count{200: 1, 201: 1},
		AverageDuration: 9.5,
	}
}

func endpointAggB() discovery.EndpointAgg {
	return discovery.EndpointAgg{
		MinTime:         1687935138000, // Thu, 28 Jun 2023 06:52:18 GMT
		MaxTime:         1688021538000, // Thu, 29 Jun 2023 06:52:18 GMT
		Count:           3,
		StatusCodes:     map[int]discovery.Count{200: 2, 404: 1},
		AverageDuration: 12.0,
	}
}

func endpointAggC() discovery.EndpointAgg {
	return discovery.EndpointAgg{
		MinTime:         1687762338000, // Thu, 26 Jun 2023 06:52:18 GMT,
		MaxTime:         1688021538000, // Thu, 29 Jun 2023 06:52:18 GMT
		Count:           2,
		StatusCodes:     map[int]discovery.Count{218: 2},
		AverageDuration: 11.0,
	}
}

func endpointAggEmpty() discovery.EndpointAgg {
	return discovery.EndpointAgg{
		MinTime:         0,
		MaxTime:         0,
		Count:           0,
		StatusCodes:     make(map[int]discovery.Count),
		AverageDuration: 0.0,
	}
}

func interceptorAggA() discovery.InterceptorAgg {
	return discovery.InterceptorAgg{
		Timestamp: endpointAggA().MaxTime,
	}
}

func interceptorAggB() discovery.InterceptorAgg {
	return discovery.InterceptorAgg{
		Timestamp: endpointAggB().MaxTime,
	}
}

func interceptorAggC() discovery.InterceptorAgg {
	return discovery.InterceptorAgg{
		Timestamp: endpointAggB().MaxTime,
	}
}

func interceptorAggEmpty() discovery.InterceptorAgg {
	return discovery.InterceptorAgg{
		Timestamp: 0,
	}
}

func TestCombineAggMapsInitial(t *testing.T) {
	t.Parallel()
	// at first the state is just an empty map
	empty := discovery.Agg{
		Interceptors: make(map[common.Interceptor]discovery.InterceptorAgg),
		Endpoints:    make(map[common.Endpoint]discovery.EndpointAgg),
	}

	endpointA := common.Endpoint{
		Method: "GET",
		URL:    "foo.com/bar",
	}

	interceptorA := common.Interceptor{
		Type:    "lunar-aiohttp-interceptor",
		Version: "2.0.2",
	}

	a := discovery.Agg{ //nolint:varnamelen
		Endpoints: map[common.Endpoint]discovery.EndpointAgg{
			endpointA: endpointAggA(),
		},
		Interceptors: map[common.Interceptor]discovery.InterceptorAgg{
			interceptorA: interceptorAggA(),
		},
	}

	combined := discovery.CombineAggregation(empty, a)

	combinedEndpointA, found := combined.Endpoints[endpointA]
	assert.True(t, found)
	assert.Equal(t, combinedEndpointA, endpointAggA())

	combinedInterceptorA, found := combined.Interceptors[interceptorA]
	assert.True(t, found)
	assert.Equal(t, combinedInterceptorA, interceptorAggA())
}

func TestCombineAggMaps(t *testing.T) {
	t.Parallel()
	endpointA := common.Endpoint{
		Method: "GET",
		URL:    "foo.com/bar",
	}
	endpointB := common.Endpoint{
		Method: "GET",
		URL:    "foo.com/quu",
	}

	interceptorA := common.Interceptor{
		Type:    "lunar-aiohttp-interceptor",
		Version: "2.0.2",
	}

	interceptorB := common.Interceptor{
		Type:    "lunar-requests-interceptor",
		Version: "2.0.3",
	}

	a := discovery.Agg{ //nolint:varnamelen
		Endpoints: map[common.Endpoint]discovery.EndpointAgg{
			endpointA: endpointAggA(),
		},
		Interceptors: map[common.Interceptor]discovery.InterceptorAgg{
			interceptorA: interceptorAggA(),
		},
	}
	b := discovery.Agg{ //nolint:varnamelen
		Endpoints: map[common.Endpoint]discovery.EndpointAgg{
			endpointA: endpointAggB(),
			endpointB: endpointAggC(),
		},
		Interceptors: map[common.Interceptor]discovery.InterceptorAgg{
			interceptorA: interceptorAggB(),
			interceptorB: interceptorAggC(),
		},
	}

	combined := discovery.CombineAggregation(a, b)

	combinedEndpointA, found := combined.Endpoints[endpointA]
	assert.True(t, found)
	assert.Equal(t, combinedEndpointA.Count, discovery.Count(5))
	assert.Equal(t, combinedEndpointA.MinTime, int64(endpointAggA().MinTime))
	assert.Equal(t, combinedEndpointA.MaxTime, int64(endpointAggB().MaxTime))
	endpointAStatusCodes := map[int]discovery.Count{200: 3, 201: 1, 404: 1}
	assert.Equal(t,
		combinedEndpointA.StatusCodes,
		endpointAStatusCodes,
	)
	assert.Equal(t, combinedEndpointA.AverageDuration, float32(11.0))

	combinedEndpointB, found := combined.Endpoints[endpointB]
	assert.True(t, found)
	assert.Equal(t, combinedEndpointB, endpointAggC())

	combinedInterceptorA, found := combined.Interceptors[interceptorA]
	assert.True(t, found)
	assert.Equal(t, combinedInterceptorA.Timestamp,
		interceptorAggB().Timestamp)
}

func TestCombineAggMapsWhenOneMapValuesAreEmpty(
	t *testing.T,
) {
	t.Parallel()
	endpointA := common.Endpoint{
		Method: "GET",
		URL:    "foo.com/bar",
	}
	interceptorA := common.Interceptor{
		Type:    "lunar-aiohttp-interceptor",
		Version: "2.0.2",
	}
	endpointAggA := endpointAggA()
	endpointAggEmpty := endpointAggEmpty()

	interceptorAggA := interceptorAggA()
	interceptorAggEmpty := interceptorAggEmpty()
	a := discovery.Agg{ //nolint:varnamelen
		Endpoints: map[common.Endpoint]discovery.EndpointAgg{
			endpointA: endpointAggA,
		},
		Interceptors: map[common.Interceptor]discovery.InterceptorAgg{
			interceptorA: interceptorAggA,
		},
	}
	b := discovery.Agg{ //nolint:varnamelen
		Endpoints: map[common.Endpoint]discovery.EndpointAgg{
			endpointA: endpointAggEmpty,
		},
		Interceptors: map[common.Interceptor]discovery.InterceptorAgg{
			interceptorA: interceptorAggEmpty,
		},
	}
	combined := discovery.CombineAggregation(a, b)

	combinedEndpointA, found := combined.Endpoints[endpointA]
	assert.True(t, found)
	// The only field which is equal to the empty map is the min time since
	// the zero-value for `int` is... 0.
	assert.Equal(t, combinedEndpointA.MinTime, endpointAggEmpty.MinTime)
	assert.Equal(t, combinedEndpointA.MaxTime, endpointAggA.MaxTime)
	assert.Equal(t, combinedEndpointA.StatusCodes, endpointAggA.StatusCodes)
	assert.Equal(t, combinedEndpointA.AverageDuration,
		endpointAggA.AverageDuration)

	combinedInterceptorA, found := combined.Interceptors[interceptorA]
	assert.True(t, found)
	assert.Equal(t,
		combinedInterceptorA.Timestamp,
		interceptorAggA.Timestamp,
	)
}

func TestCombineAggMapsWhenBothEmptyItReturnsEmptyMap(t *testing.T) {
	t.Parallel()
	// at first the state is just an empty map
	empty := discovery.Agg{
		Endpoints:    make(map[common.Endpoint]discovery.EndpointAgg),
		Interceptors: make(map[common.Interceptor]discovery.InterceptorAgg),
	}

	combined := discovery.CombineAggregation(empty, empty)

	assert.Equal(t, combined, empty)
}
