package discovery_test

import (
	"fmt"
	"lunar/aggregation-plugin/common"
	"lunar/aggregation-plugin/discovery"
	sharedDiscovery "lunar/shared-model/discovery"
	"testing"

	"github.com/rs/zerolog/log"
	"github.com/stretchr/testify/assert"
)

func TestExtractAggs(t *testing.T) {
	t.Parallel()
	endpointA := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "foo.org/bar",
	}
	endpointB := sharedDiscovery.Endpoint{
		Method: "POST",
		URL:    "foo.org/bar",
	}
	endpointC := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "foo.org/quu",
	}

	interceptorA := common.Interceptor{
		Type:    "lunar-aiohttp-interceptor",
		Version: "2.0.2",
	}

	interceptorB := common.Interceptor{
		Type:    "lunar-aiohttp-interceptor",
		Version: "2.0.0",
	}

	interceptorC := common.Interceptor{
		Type:    "lunar-requests-interceptor",
		Version: "1.0.1",
	}

	tree, err := common.BuildTree(
		sharedDiscovery.KnownEndpoints{
			Endpoints: []sharedDiscovery.Endpoint{endpointA, endpointB, endpointC},
		},
		2,
	)
	assert.Nil(t, err)

	accessLogs := []discovery.AccessLog{
		{
			ConsumerTag: "consumerA",
			Timestamp:   1687243938000, // Thu, 20 Jun 2023 06:52:18 GMT
			Duration:    10,
			StatusCode:  200,
			Method:      endpointA.Method,
			URL:         endpointA.URL,
			Interceptor: fmt.Sprintf(
				"%s/%s", interceptorA.Type, interceptorA.Version),
		},
		{
			ConsumerTag: "consumerA",
			Timestamp:   1687935138000, // Thu, 28 Jun 2023 06:52:18 GMT
			Duration:    5,
			StatusCode:  400,
			Method:      endpointA.Method,
			URL:         endpointA.URL,
			Interceptor: fmt.Sprintf(
				"%s/%s", interceptorA.Type, interceptorA.Version),
		},
		{
			ConsumerTag: "consumerB",
			Timestamp:   1688021538000, // Thu, 29 Jun 2023 06:52:18 GMT
			Duration:    58,
			StatusCode:  401,
			Method:      endpointB.Method,
			URL:         endpointB.URL,
			Interceptor: fmt.Sprintf(
				"%s/%s", interceptorB.Type, interceptorB.Version),
		},
		{
			Timestamp:  1687675938000, // Thu, 25 Jun 2023 06:52:18 GMT
			Duration:   298,
			StatusCode: 404,
			Method:     endpointC.Method,
			URL:        endpointC.URL,
			Interceptor: fmt.Sprintf(
				"%s/%s", interceptorC.Type, interceptorC.Version),
		},
	}

	wantEndpointAAgg := sharedDiscovery.EndpointAgg{
		MinTime:         1687243938000,
		MaxTime:         1687935138000,
		Count:           2,
		StatusCodes:     map[int]sharedDiscovery.Count{200: 1, 400: 1},
		AverageDuration: 7.5,
	}

	wantEndpointBAgg := sharedDiscovery.EndpointAgg{
		MinTime:         1688021538000,
		MaxTime:         1688021538000,
		Count:           1,
		StatusCodes:     map[int]sharedDiscovery.Count{401: 1},
		AverageDuration: 58,
	}
	wantEndpointCAgg := sharedDiscovery.EndpointAgg{
		MinTime:         1687675938000,
		MaxTime:         1687675938000,
		Count:           1,
		StatusCodes:     map[int]sharedDiscovery.Count{404: 1},
		AverageDuration: 298,
	}

	wantInterceptorAAgg := discovery.InterceptorAgg{
		Timestamp: 1687935138000,
	}

	wantInterceptorBAgg := discovery.InterceptorAgg{
		Timestamp: 1688021538000,
	}

	res := discovery.ExtractAggs(accessLogs, tree)
	resEndpointA, found := res.Endpoints[endpointA]
	assert.True(t, found)
	assert.Equal(t, resEndpointA.Count, wantEndpointAAgg.Count)
	assert.Equal(t, resEndpointA.MinTime, wantEndpointAAgg.MinTime)
	assert.Equal(t, resEndpointA.MaxTime, wantEndpointAAgg.MaxTime)
	assert.Equal(t, resEndpointA.StatusCodes, wantEndpointAAgg.StatusCodes)
	assert.Equal(t, res.Consumers["consumerA"][endpointA], wantEndpointAAgg)
	assert.Equal(t, res.Consumers["consumerB"][endpointB], wantEndpointBAgg)
	assert.Equal(
		t,
		resEndpointA.AverageDuration,
		wantEndpointAAgg.AverageDuration,
	)

	resEndpointB, found := res.Endpoints[endpointB]
	assert.True(t, found)
	assert.Equal(t, resEndpointB, wantEndpointBAgg)

	resEndpointC, found := res.Endpoints[endpointC]
	assert.True(t, found)
	assert.Equal(t, resEndpointC, wantEndpointCAgg)

	resInterceptorA, found := res.Interceptors[interceptorA]
	assert.True(t, found)
	assert.Equal(t, resInterceptorA.Timestamp,
		wantInterceptorAAgg.Timestamp)

	resInterceptorB, found := res.Interceptors[interceptorB]
	assert.True(t, found)
	assert.Equal(t, resInterceptorB.Timestamp,
		wantInterceptorBAgg.Timestamp)
}

func TestExtractAggsWithParametericPathParts(t *testing.T) {
	t.Parallel()
	endpointA := sharedDiscovery.Endpoint{
		Method: "POST",
		URL:    "foo.org/user/{id}",
	}
	endpointB := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "foo.org/bar",
	}

	tree, err := common.BuildTree(
		sharedDiscovery.KnownEndpoints{
			Endpoints: []sharedDiscovery.Endpoint{endpointA, endpointB},
		},
		2,
	)
	assert.Nil(t, err)

	accessLogs := []discovery.AccessLog{
		{
			Timestamp:  1687243938000,
			Duration:   10,
			StatusCode: 200,
			Method:     endpointA.Method,
			URL:        "foo.org/user/20",
		},
		{
			Timestamp:  1687935138000,
			Duration:   5,
			StatusCode: 400,
			Method:     endpointA.Method,
			URL:        "foo.org/user/30",
		},
		{
			Timestamp:  1687935138000,
			Duration:   58,
			StatusCode: 401,
			Method:     endpointB.Method,
			URL:        endpointB.URL,
		},
	}

	wantEndpointAAgg := sharedDiscovery.EndpointAgg{
		MinTime:         1687243938000,
		MaxTime:         1687935138000,
		Count:           2,
		StatusCodes:     map[int]sharedDiscovery.Count{200: 1, 400: 1},
		AverageDuration: 7.5,
	}

	wantEndpointBAgg := sharedDiscovery.EndpointAgg{
		MinTime:         1687935138000,
		MaxTime:         1687935138000,
		Count:           1,
		StatusCodes:     map[int]sharedDiscovery.Count{401: 1},
		AverageDuration: 58,
	}

	res := discovery.ExtractAggs(accessLogs, tree)
	log.Debug().Msgf("res: %+v", res)
	resA, found := res.Endpoints[endpointA]
	assert.True(t, found)
	assert.Equal(t, resA.Count, wantEndpointAAgg.Count)
	assert.Equal(t, resA.MinTime, wantEndpointAAgg.MinTime)
	assert.Equal(t, resA.MaxTime, wantEndpointAAgg.MaxTime)
	assert.Equal(t, resA.StatusCodes, wantEndpointAAgg.StatusCodes)
	assert.Equal(t, resA.AverageDuration, wantEndpointAAgg.AverageDuration)

	resB, found := res.Endpoints[endpointB]
	assert.True(t, found)
	assert.Equal(t, resB, wantEndpointBAgg)
}

func TestExtractAggsWithPathParamsAndOverlappingConstantPart(t *testing.T) {
	t.Parallel()
	endpointA := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "foo.org/user/{id}/profile/{profile_id}",
	}
	endpointB := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "foo.org/user/admin/profile/{admin_profile_id}",
	}

	tree, err := common.BuildTree(
		sharedDiscovery.KnownEndpoints{
			Endpoints: []sharedDiscovery.Endpoint{endpointA, endpointB},
		},
		2,
	)
	assert.Nil(t, err)

	accessLogs := []discovery.AccessLog{
		{
			Timestamp:  1687243938000,
			Duration:   10,
			StatusCode: 200,
			Method:     endpointA.Method,
			URL:        "foo.org/user/20/profile/30",
		},
		{
			Timestamp:  1687935138000,
			Duration:   5,
			StatusCode: 400,
			Method:     endpointA.Method,
			URL:        "foo.org/user/30/profile/40",
		},
		{
			Timestamp:  1687935138000,
			Duration:   58,
			StatusCode: 401,
			Method:     endpointB.Method,
			URL:        "foo.org/user/admin/profile/50",
		},
	}

	wantEndpointAAgg := sharedDiscovery.EndpointAgg{
		MinTime:         1687243938000,
		MaxTime:         1687935138000,
		Count:           2,
		StatusCodes:     map[int]sharedDiscovery.Count{200: 1, 400: 1},
		AverageDuration: 7.5,
	}

	wantEndpointBAgg := sharedDiscovery.EndpointAgg{
		MinTime:         1687935138000,
		MaxTime:         1687935138000,
		Count:           1,
		StatusCodes:     map[int]sharedDiscovery.Count{401: 1},
		AverageDuration: 58,
	}

	res := discovery.ExtractAggs(accessLogs, tree)
	log.Debug().Msgf("res: %+v", res)
	resA, found := res.Endpoints[endpointA]
	assert.True(t, found)
	assert.Equal(t, resA.Count, wantEndpointAAgg.Count)
	assert.Equal(t, resA.MinTime, wantEndpointAAgg.MinTime)
	assert.Equal(t, resA.MaxTime, wantEndpointAAgg.MaxTime)
	assert.Equal(t, resA.StatusCodes, wantEndpointAAgg.StatusCodes)
	assert.Equal(t, resA.AverageDuration, wantEndpointAAgg.AverageDuration)

	resB, found := res.Endpoints[endpointB]
	assert.True(t, found)
	assert.Equal(t, resB, wantEndpointBAgg)
}
