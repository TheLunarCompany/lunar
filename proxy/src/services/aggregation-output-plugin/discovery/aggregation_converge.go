package discovery

import (
	"lunar/aggregation-plugin/common"
)

func ConvergeAggregation(
	aggregation Agg,
	accessLogs []AccessLog,
	tree common.SimpleURLTreeI,
) (Agg, error) {
	urls := []string{}
	for _, accessLog := range accessLogs {
		urls = append(urls, accessLog.URL)
	}
	convergenceOccurred, err := common.NormalizeTree(tree, urls)
	if err != nil {
		return aggregation, err
	}
	if !convergenceOccurred {
		return aggregation, nil
	}
	endpointsAgg := map[common.Endpoint]EndpointAgg{}
	for endpoint, agg := range aggregation.Endpoints {
		normEndpoint := common.Endpoint{
			Method: endpoint.Method,
			URL:    common.NormalizeURL(tree, endpoint.URL),
		}
		if _, exists := endpointsAgg[normEndpoint]; !exists {
			endpointsAgg[normEndpoint] = agg
			continue
		}
		endpointsAgg[normEndpoint] = endpointsAgg[normEndpoint].Combine(agg)
	}
	return Agg{
		Interceptors: aggregation.Interceptors,
		Endpoints:    endpointsAgg,
	}, nil
}
