package discovery_test

import (
	"lunar/aggregation-plugin/common"
	"lunar/aggregation-plugin/discovery"
	sharedDiscovery "lunar/shared-model/discovery"
	"testing"

	"github.com/stretchr/testify/assert"
)

func endpointAgg() sharedDiscovery.EndpointAgg {
	return sharedDiscovery.EndpointAgg{
		MinTime:         1687762338000, // Thu, 26 Jun 2023 06:52:18 GMT
		MaxTime:         1687848738000, // Thu, 27 Jun 2023 06:52:18 GMT
		Count:           2,
		StatusCodes:     map[int]sharedDiscovery.Count{200: 1, 201: 1},
		AverageDuration: 9.5,
	}
}

func interceptorAgg() discovery.InterceptorAgg {
	return discovery.InterceptorAgg{
		Timestamp: endpointAgg().MaxTime,
	}
}

func TestItConvertsAggregationAndAddRequiredRatiosFromTotalCount(t *testing.T) {
	endpoint := sharedDiscovery.Endpoint{
		Method: "GET",
		URL:    "foo.com/bar",
	}

	interceptor := common.Interceptor{
		Type:    "lunar-aiohttp-interceptor",
		Version: "2.0.2",
	}

	discoveryAgg := discovery.Agg{
		Endpoints: map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg{
			endpoint: endpointAgg(),
		},
		Interceptors: map[common.Interceptor]discovery.InterceptorAgg{
			interceptor: interceptorAgg(),
		},
		Consumers: map[string]discovery.EndpointMapping{
			"consumerA": {
				endpoint: endpointAgg(),
			},
		},
	}

	outputAgg := discovery.ConvertToPersisted(discoveryAgg)

	wantDiscoveryOutput := sharedDiscovery.Output{
		Interceptors: []sharedDiscovery.InterceptorOutput{
			{
				Type:                "lunar-aiohttp-interceptor",
				Version:             "2.0.2",
				LastTransactionDate: "2023-06-27T06:52:18Z",
			},
		},
		Endpoints: map[string]sharedDiscovery.EndpointOutput{
			"GET:::foo.com/bar": {
				MinTime:         "2023-06-26T06:52:18Z",
				MaxTime:         "2023-06-27T06:52:18Z",
				Count:           2,
				StatusCodes:     map[int]int{200: 1, 201: 1},
				AverageDuration: 9.5,
			},
		},
		Consumers: map[string]map[string]sharedDiscovery.EndpointOutput{
			"consumerA": {
				"GET:::foo.com/bar": {
					MinTime:         "2023-06-26T06:52:18Z",
					MaxTime:         "2023-06-27T06:52:18Z",
					Count:           2,
					StatusCodes:     map[int]int{200: 1, 201: 1},
					AverageDuration: 9.5,
				},
			},
		},
	}

	assert.Equal(t, wantDiscoveryOutput, outputAgg)
}
