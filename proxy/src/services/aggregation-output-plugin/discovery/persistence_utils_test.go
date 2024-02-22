package discovery_test

import (
	"lunar/aggregation-plugin/common"
	"lunar/aggregation-plugin/discovery"
	sharedActions "lunar/shared-model/actions"
	"lunar/toolkit-core/clock"
	"testing"

	"github.com/stretchr/testify/assert"
)

func endpointAgg() discovery.EndpointAgg {
	return discovery.EndpointAgg{
		MinTime:         1687762338000, // Thu, 26 Jun 2023 06:52:18 GMT
		MaxTime:         1687848738000, // Thu, 27 Jun 2023 06:52:18 GMT
		Count:           2,
		StatusCodes:     map[int]discovery.Count{200: 1, 201: 1},
		AverageDuration: 9.5,
	}
}

func interceptorAgg() discovery.InterceptorAgg {
	return discovery.InterceptorAgg{
		Timestamp: endpointAgg().MaxTime,
	}
}

func TestItConvertsAggregationAndAddRequiredRatiosFromTotalCount(t *testing.T) {
	endpoint := common.Endpoint{
		Method: "GET",
		URL:    "foo.com/bar",
	}

	interceptor := common.Interceptor{
		Type:    "lunar-aiohttp-interceptor",
		Version: "2.0.2",
	}

	discoveryAgg := discovery.Agg{
		Endpoints: map[common.Endpoint]discovery.EndpointAgg{
			endpoint: endpointAgg(),
		},
		Interceptors: map[common.Interceptor]discovery.InterceptorAgg{
			interceptor: interceptorAgg(),
		},
	}

	clock := clock.NewMockClock()
	outputAgg := discovery.ConvertToPersisted(discoveryAgg, clock)

	wantDiscoveryOutput := discovery.Output{
		CreatedAt: sharedActions.TimestampToStringFromTime(clock.Now()),
		Interceptors: []discovery.InterceptorOutput{
			{
				Type:                "lunar-aiohttp-interceptor",
				Version:             "2.0.2",
				LastTransactionDate: "2023-06-27T06:52:18Z",
			},
		},
		Endpoints: map[string]discovery.EndpointOutput{
			"GET:::foo.com/bar": {
				MinTime:         "2023-06-26T06:52:18Z",
				MaxTime:         "2023-06-27T06:52:18Z",
				Count:           2,
				StatusCodes:     map[int]discovery.Count{200: 1, 201: 1},
				AverageDuration: 9.5,
			},
		},
	}

	assert.Equal(t, wantDiscoveryOutput, outputAgg)
}
