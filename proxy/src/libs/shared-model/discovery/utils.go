package shareddiscovery

import (
	sharedActions "lunar/shared-model/actions"
	"strings"

	"github.com/rs/zerolog/log"
)

func ConvertConsumersFromPersisted(
	consumers map[string]map[string]EndpointOutput,
) map[string]EndpointMapping {
	output := make(map[string]EndpointMapping)

	for consumer, endpoints := range consumers {
		output[consumer] = make(map[Endpoint]EndpointAgg)
		for key, endpoint := range endpoints {
			parts := strings.Split(key, EndpointDelimiter)
			minTime, err := sharedActions.TimestampFromStringToInt64(endpoint.MinTime)
			if err != nil {
				log.Error().Msgf("Error converting timestamp: %v", err)
				minTime = 0
			}
			maxTime, err := sharedActions.TimestampFromStringToInt64(endpoint.MaxTime)
			if err != nil {
				log.Error().Msgf("Error converting timestamp: %v", err)
				maxTime = 0
			}
			output[consumer][Endpoint{
				Method: parts[0],
				URL:    parts[1],
			}] = ConvertEndpointFromPersisted(minTime, maxTime, endpoint)
		}
	}
	return output
}

func ConvertEndpointsFromPersisted(endpoints map[string]EndpointOutput) map[Endpoint]EndpointAgg {
	output := make(map[Endpoint]EndpointAgg)

	for key, endpoint := range endpoints {
		parts := strings.Split(key, EndpointDelimiter)
		minTime, err := sharedActions.TimestampFromStringToInt64(endpoint.MinTime)
		if err != nil {
			log.Error().Msgf("Error converting timestamp: %v", err)
			minTime = 0
		}
		maxTime, err := sharedActions.TimestampFromStringToInt64(endpoint.MaxTime)
		if err != nil {
			log.Error().Msgf("Error converting timestamp: %v", err)
			maxTime = 0
		}
		output[Endpoint{
			Method: parts[0],
			URL:    parts[1],
		}] = ConvertEndpointFromPersisted(minTime, maxTime, endpoint)
	}
	return output
}

func ConvertEndpointFromPersisted(
	minTime, maxTime int64,
	endpoint EndpointOutput,
) EndpointAgg {
	return EndpointAgg{
		MinTime:              minTime,
		MaxTime:              maxTime,
		Count:                Count(endpoint.Count),
		StatusCodes:          convertMapOfIntToCount(endpoint.StatusCodes),
		AverageDuration:      endpoint.AverageDuration,
		AverageTotalDuration: endpoint.AverageTotalDuration,
	}
}

func convertMapOfIntToCount(ints map[int]int) map[int]Count {
	result := make(map[int]Count)
	for key, value := range ints {
		result[key] = Count(value)
	}
	return result
}
