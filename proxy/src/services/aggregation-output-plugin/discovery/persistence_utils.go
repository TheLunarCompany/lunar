package discovery

import (
	"lunar/aggregation-plugin/common"
	sharedActions "lunar/shared-model/actions"
	sharedDiscovery "lunar/shared-model/discovery"
	"strings"
)

const (
	endpointDelimiter = ":::"
)

func ConvertToPersisted(aggregations Agg) sharedDiscovery.Output {
	output := sharedDiscovery.Output{
		Interceptors: []sharedDiscovery.InterceptorOutput{},
		Endpoints:    map[string]sharedDiscovery.EndpointOutput{},
	}

	for endpoint, agg := range aggregations.Endpoints {
		key := dumpEndpoint(endpoint)
		output.Endpoints[key] = sharedDiscovery.EndpointOutput{
			MinTime: sharedActions.TimestampToStringFromInt64(
				agg.MinTime),
			MaxTime: sharedActions.TimestampToStringFromInt64(
				agg.MaxTime),
			Count:           int(agg.Count),
			StatusCodes:     convertMapOfCountToInt(agg.StatusCodes),
			AverageDuration: agg.AverageDuration,
		}
	}

	for interceptor, agg := range aggregations.Interceptors {
		output.Interceptors = append(output.Interceptors, sharedDiscovery.InterceptorOutput{
			Type:    interceptor.Type,
			Version: interceptor.Version,
			LastTransactionDate: sharedActions.TimestampToStringFromInt64(
				agg.Timestamp),
		})
	}

	return output
}

func dumpEndpoint(endpoint common.Endpoint) string {
	return strings.Join([]string{endpoint.Method, endpoint.URL}, endpointDelimiter)
}

func convertMapOfCountToInt(m map[int]Count) map[int]int {
	result := make(map[int]int)
	for k, v := range m {
		result[k] = int(v)
	}
	return result
}
