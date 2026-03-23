package discovery

import (
	"lunar/aggregation-plugin/common"
	sharedDiscovery "lunar/shared-model/discovery"
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
	endpointsAgg := map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg{}
	for endpoint, agg := range aggregation.Endpoints {
		normEndpoint := sharedDiscovery.Endpoint{
			Method: endpoint.Method,
			URL:    common.NormalizeURL(tree, endpoint.URL),
		}
		if _, exists := endpointsAgg[normEndpoint]; !exists {
			endpointsAgg[normEndpoint] = agg
			continue
		}
		endpointsAgg[normEndpoint] = endpointsAgg[normEndpoint].Combine(agg)
	}

	consumerAgg := map[string]sharedDiscovery.EndpointMapping{}
	for consumer, mapping := range aggregation.Consumers {
		normMapping := sharedDiscovery.EndpointMapping{}
		for endpoint, agg := range mapping {
			normEndpoint := sharedDiscovery.Endpoint{
				Method: endpoint.Method,
				URL:    common.NormalizeURL(tree, endpoint.URL),
			}
			if _, exists := normMapping[normEndpoint]; !exists {
				normMapping[normEndpoint] = agg
				continue
			}
			normMapping[normEndpoint] = normMapping[normEndpoint].Combine(agg)
		}
		consumerAgg[consumer] = normMapping
	}

	return Agg{
		Interceptors: aggregation.Interceptors,
		Endpoints:    endpointsAgg,
		Consumers:    consumerAgg,
	}, nil
}
