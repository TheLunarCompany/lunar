package discovery_test

import (
	"lunar/aggregation-plugin/common"
	"lunar/aggregation-plugin/discovery"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIfNoNewURLsAddedAggRemainsTheSame(t *testing.T) {
	t.Parallel()
	endpointA := common.Endpoint{
		Method: "GET",
		URL:    "api.com/user/1",
	}

	endpointB := common.Endpoint{
		Method: "GET",
		URL:    "api.com/user/2",
	}

	interceptorA := common.Interceptor{
		Type:    "lunar-aiohttp-interceptor",
		Version: "2.0.2",
	}

	initial := discovery.Agg{
		Endpoints: map[common.Endpoint]discovery.EndpointAgg{
			endpointA: endpointAggA(),
			endpointB: endpointAggB(),
		},
		Interceptors: map[common.Interceptor]discovery.InterceptorAgg{
			interceptorA: interceptorAggA(),
		},
		Consumers: map[string]discovery.EndpointMapping{
			"consumerA": {
				endpointA: endpointAggA(),
			},
			"consumerB": {
				endpointB: endpointAggB(),
			},
		},
	}

	maxSplitThreshold := 2
	tree, err := common.BuildTree(
		common.KnownEndpoints{
			Endpoints: []common.Endpoint{endpointA, endpointB},
		},
		maxSplitThreshold,
	)
	assert.Nil(t, err)

	updatedAgg, err := discovery.ConvergeAggregation(
		initial,
		[]discovery.AccessLog{},
		tree,
	)
	assert.Nil(t, err)
	assert.Equal(t, initial, updatedAgg)
}

func TestIfNewURLsAddedAggEndpointsConverged_RegardlessOfMethod(t *testing.T) {
	t.Parallel()
	endpointA := common.Endpoint{
		Method: "GET",
		URL:    "api.com/user/1",
	}

	endpointB := common.Endpoint{
		Method: "GET",
		URL:    "api.com/user/2",
	}

	endpointC := common.Endpoint{
		Method: "POST",
		URL:    "api.com/unrelated/1",
	}

	interceptorA := common.Interceptor{
		Type:    "lunar-aiohttp-interceptor",
		Version: "2.0.2",
	}

	initial := discovery.Agg{
		Endpoints: map[common.Endpoint]discovery.EndpointAgg{
			endpointA: endpointAggA(),
			endpointB: endpointAggB(),
			endpointC: endpointAggC(),
		},
		Interceptors: map[common.Interceptor]discovery.InterceptorAgg{
			interceptorA: interceptorAggA(),
		},
		Consumers: map[string]discovery.EndpointMapping{
			"consumerA": {
				endpointA: endpointAggA(),
			},
			"consumerB": {
				endpointB: endpointAggB(),
			},
			"consumerC": {
				endpointB: endpointAggC(),
			},
		},
	}

	maxSplitThreshold := 2
	tree, err := common.BuildTree(
		common.KnownEndpoints{
			Endpoints: []common.Endpoint{endpointA, endpointB, endpointC},
		},
		maxSplitThreshold,
	)
	assert.Nil(t, err)

	updatedAgg, err := discovery.ConvergeAggregation(
		initial,
		[]discovery.AccessLog{
			{Method: "POST", URL: "api.com/user/3", ConsumerTag: "consumerC"},
		},
		tree,
	)
	assert.Nil(t, err)
	assert.NotEqual(t, initial, updatedAgg)
	assert.Len(t, updatedAgg.Endpoints, 2)
	assert.Contains(t, updatedAgg.Endpoints, endpointC)
	assert.Contains(t, updatedAgg.Consumers, "consumerC")

	convergedEndpoint := common.Endpoint{
		Method: "GET",
		URL:    "api.com/user/{_param_1}",
	}
	assert.Contains(t, updatedAgg.Endpoints, convergedEndpoint)
	convergedEndpointAgg, exists := updatedAgg.Endpoints[convergedEndpoint]

	assert.True(t, exists)

	combinedEndpointAgg := endpointAggA().Combine(endpointAggB())
	assert.Equal(t, combinedEndpointAgg, convergedEndpointAgg)

	// Interceptors are not affected
	assert.Equal(t, initial.Interceptors, updatedAgg.Interceptors)
}
