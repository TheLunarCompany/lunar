package discovery

import (
	"lunar/aggregation-plugin/common"
	sharedActions "lunar/shared-model/actions"
	sharedDiscovery "lunar/shared-model/discovery"
	"strings"

	"github.com/rs/zerolog/log"
)

func ConvertToPersisted(aggregations Agg) sharedDiscovery.Output {
	output := sharedDiscovery.Output{
		Interceptors: []sharedDiscovery.InterceptorOutput{},
		Endpoints:    map[string]sharedDiscovery.EndpointOutput{},
		Consumers:    map[string]map[string]sharedDiscovery.EndpointOutput{},
	}

	for endpoint, agg := range aggregations.Endpoints {
		key := dumpEndpoint(endpoint)
		output.Endpoints[key] = convertEndpointToPersisted(agg)
	}

	for consumer, endpoints := range aggregations.Consumers {
		output.Consumers[consumer] = map[string]sharedDiscovery.EndpointOutput{}
		for endpoint, agg := range endpoints {
			key := dumpEndpoint(endpoint)
			output.Consumers[consumer][key] = convertEndpointToPersisted(agg)
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

func ConvertFromPersisted(output sharedDiscovery.Output) *Agg {
	aggregations := Agg{
		Interceptors: map[common.Interceptor]InterceptorAgg{},
		Endpoints:    map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg{},
		Consumers:    map[string]sharedDiscovery.EndpointMapping{},
	}

	aggregations.Endpoints = sharedDiscovery.ConvertEndpointsFromPersisted(output.Endpoints)
	aggregations.Consumers = sharedDiscovery.ConvertConsumersFromPersisted(output.Consumers)

	for _, interceptor := range output.Interceptors {
		timestamp, err := sharedActions.TimestampFromStringToInt64(interceptor.LastTransactionDate)
		if err != nil {
			log.Error().Msgf("Error converting timestamp: %v", err)
			timestamp = 0
		}
		aggregations.Interceptors[common.Interceptor{
			Type:    interceptor.Type,
			Version: interceptor.Version,
		}] = InterceptorAgg{
			Timestamp: timestamp,
		}
	}

	return &aggregations
}

func dumpEndpoint(endpoint sharedDiscovery.Endpoint) string {
	return strings.Join([]string{endpoint.Method, endpoint.URL}, sharedDiscovery.EndpointDelimiter)
}

func convertMapOfCountToInt(counts map[int]sharedDiscovery.Count) map[int]int {
	result := make(map[int]int)
	for key, value := range counts {
		result[key] = int(value)
	}
	return result
}

func convertEndpointToPersisted(agg sharedDiscovery.EndpointAgg) sharedDiscovery.EndpointOutput {
	return sharedDiscovery.EndpointOutput{
		MinTime:              sharedActions.TimestampToStringFromInt64(agg.MinTime),
		MaxTime:              sharedActions.TimestampToStringFromInt64(agg.MaxTime),
		Count:                int(agg.Count),
		StatusCodes:          convertMapOfCountToInt(agg.StatusCodes),
		AverageDuration:      agg.AverageDuration,
		AverageTotalDuration: agg.AverageTotalDuration,
	}
}
