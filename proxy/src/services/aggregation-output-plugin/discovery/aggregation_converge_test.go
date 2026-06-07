package discovery_test

import (
	"lunar/aggregation-plugin/common"
	"lunar/aggregation-plugin/discovery"
	sharedDiscovery "lunar/shared-model/discovery"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIfNoNewURLsAddedAggRemainsTheSame(t *testing.T) {
	t.Parallel()
	endpointA := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "api.com/user/1",
	}

	endpointB := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "api.com/user/2",
	}

	interceptorA := common.Interceptor{
		Type:    "lunar-aiohttp-interceptor",
		Version: "2.0.2",
	}

	initial := discovery.Agg{
		Endpoints: map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg{
			endpointA: endpointAggA(),
			endpointB: endpointAggB(),
		},
		Interceptors: map[common.Interceptor]discovery.InterceptorAgg{
			interceptorA: interceptorAggA(),
		},
		Consumers: map[string]sharedDiscovery.EndpointMapping{
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
		sharedDiscovery.KnownEndpoints{
			Endpoints: []sharedDiscovery.Endpoint{endpointA, endpointB},
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
	endpointA := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "api.com/user/1",
	}

	endpointB := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "api.com/user/2",
	}

	endpointC := sharedDiscovery.Endpoint{
		Method: "POST",
		URL:    "api.com/unrelated/1",
	}

	interceptorA := common.Interceptor{
		Type:    "lunar-aiohttp-interceptor",
		Version: "2.0.2",
	}

	initial := discovery.Agg{
		Endpoints: map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg{
			endpointA: endpointAggA(),
			endpointB: endpointAggB(),
			endpointC: endpointAggC(),
		},
		Interceptors: map[common.Interceptor]discovery.InterceptorAgg{
			interceptorA: interceptorAggA(),
		},
		Consumers: map[string]sharedDiscovery.EndpointMapping{
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
		sharedDiscovery.KnownEndpoints{
			Endpoints: []sharedDiscovery.Endpoint{endpointA, endpointB, endpointC},
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

	convergedEndpoint := sharedDiscovery.Endpoint{
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

func TestConvergenceRemovesOldEntriesFromAggregation(t *testing.T) {
	t.Parallel()

	endpointA := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "spam6.com/akx0uo/uvxze7/2crsv/a5chl6/gni0o7/4k66s/7agloe/yu3pp/i72pro",
	}
	endpointB := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "spam6.com/bbnzgb/2bqqt9/d7uxjo/6zglaq/jsqmg/kjbzp/bodymb/01nux6/d68gvk",
	}
	endpointC := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "spam6.com/esg7qc/vsp6ns/lu02ss/3x401b/on4nyo/vtv51/flb4we/z9goz/6m9qx",
	}

	endpointD := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "unrelated.com/esg7qc",
	}

	endpointE := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "spam6.com/12345s/vsp6ns/lu02ss/3x401b/on4nyo/vtv51/flb4we/z9goz/6m9qx", // should be part of convergence
	}

	initial := discovery.Agg{
		Endpoints: map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg{
			endpointA: endpointAggA(),
			endpointB: endpointAggB(),
		},
		Consumers: map[string]sharedDiscovery.EndpointMapping{
			"consumerA": {endpointA: endpointAggA()},
			"consumerB": {endpointB: endpointAggB()},
		},
	}

	maxSplitThreshold := 2
	tree, err := common.BuildTree(
		sharedDiscovery.KnownEndpoints{
			Endpoints: []sharedDiscovery.Endpoint{endpointA, endpointB},
		},
		maxSplitThreshold,
	)
	require.NoError(t, err)

	// trigger convergence with a new consumer
	updatedAgg, err := discovery.ConvergeAggregation(
		initial,
		[]discovery.AccessLog{
			{
				Method:      endpointC.Method,
				URL:         endpointC.URL,
				ConsumerTag: "consumerC",
			}, // should trigger convergence
			{
				Method:      endpointD.Method,
				URL:         endpointD.URL,
				ConsumerTag: "consumerD",
			}, // not related to convergence
			{
				Method:      endpointE.Method,
				URL:         endpointE.URL,
				ConsumerTag: "consumerE",
			}, // should be part of convergence
		},
		tree,
	)
	require.NoError(t, err)

	// expected path that should exist post-convergence
	convergedEndpoint := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "spam6.com/{_param_1}/{_param_2}/{_param_3}/{_param_4}/{_param_5}/{_param_6}/{_param_7}/{_param_8}/{_param_9}",
	}
	require.Contains(t, updatedAgg.Endpoints, convergedEndpoint)
	require.True(t, tree.Lookup(convergedEndpoint.URL).Match)

	// Verify that original endpoints that were converged are removed from `updatedAgg`
	specificEndpoints := []sharedDiscovery.Endpoint{endpointA, endpointB, endpointC, endpointD, endpointE}
	for _, endpoint := range specificEndpoints {
		require.NotContains(
			t,
			updatedAgg.Endpoints,
			endpoint,
			"Expected specific path to be removed from aggregation after convergence",
		)
		require.True(t, tree.Lookup(endpoint.URL).Match) // verify that the path still exists in the tree
	}
}
