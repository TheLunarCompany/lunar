package discovery

import (
	"lunar/aggregation-plugin/common"
	sharedActions "lunar/shared-model/actions"
	"strings"
)

const (
	endpointDelimiter = ":::"
)

func ConvertToPersisted(aggregations Agg) Output {
	output := Output{
		Interceptors: []InterceptorOutput{},
		Endpoints:    map[string]EndpointOutput{},
	}

	for endpoint, agg := range aggregations.Endpoints {
		key := dumpEndpoint(endpoint)
		output.Endpoints[key] = EndpointOutput{
			MinDate: sharedActions.TimestampToStringFromInt64(
				agg.MinTime),
			MaxDate: sharedActions.TimestampToStringFromInt64(
				agg.MaxTime),
			Count:           agg.Count,
			StatusCodes:     agg.StatusCodes,
			AverageDuration: agg.AverageDuration,
		}
	}

	for interceptor, agg := range aggregations.Interceptors {
		output.Interceptors = append(output.Interceptors, InterceptorOutput{
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
