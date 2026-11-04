package discovery

import (
	"lunar/aggregation-plugin/common"
	sharedDiscovery "lunar/shared-model/discovery"
	"strings"

	"github.com/rs/zerolog/log"
	"github.com/samber/lo"
)

const (
	lunarInterceptorHeaderDelimiter = "/"
	unknownLunarInterceptor         = "unknown"
	UnknownConsumerTag              = "N/A"
)

func ExtractAggs(
	records []AccessLog,
	tree common.SimpleURLTreeI,
) Agg {
	byEndpoint := lo.GroupBy(records, accessLogToEndpoint(tree))
	byInterceptor := lo.GroupBy(records, accessLogToInterceptor())
	byConsumerTag := lo.GroupBy(records, accessLogToConsumerTag())

	mapByEndpoint := lo.MapValues(
		byEndpoint,
		func(accessLogs []AccessLog, _ sharedDiscovery.Endpoint) sharedDiscovery.EndpointAgg {
			return extractEndpointAgg(accessLogs)
		},
	)

	mapByConsumer := lo.MapValues(
		byConsumerTag,
		func(accessLogs []AccessLog, _ string) sharedDiscovery.EndpointMapping {
			return lo.MapValues(
				lo.GroupBy(accessLogs, accessLogToEndpoint(tree)),
				func(logs []AccessLog, _ sharedDiscovery.Endpoint) sharedDiscovery.EndpointAgg {
					return extractEndpointAgg(logs)
				},
			)
		},
	)

	return Agg{
		Endpoints: mapByEndpoint,
		Consumers: mapByConsumer,
		Interceptors: lo.MapValues(
			byInterceptor,
			func(accessLogs []AccessLog,
				_ common.Interceptor,
			) InterceptorAgg {
				return extractInterceptorAgg(accessLogs)
			},
		),
	}
}

func accessLogToInterceptor() func(AccessLog) common.Interceptor {
	return func(accessLog AccessLog) common.Interceptor {
		parts := strings.Split(accessLog.Interceptor,
			lunarInterceptorHeaderDelimiter)
		if len(parts) == 2 {
			return common.Interceptor{
				Type:    parts[0],
				Version: parts[1],
			}
		}
		log.Warn().Msg("Invalid or missing X-Lunar-Interceptor header format.")
		return common.Interceptor{
			Type:    unknownLunarInterceptor,
			Version: unknownLunarInterceptor,
		}
	}
}

func accessLogToConsumerTag() func(AccessLog) string {
	return func(accessLog AccessLog) string {
		if accessLog.ConsumerTag == "" {
			return UnknownConsumerTag
		}
		return accessLog.ConsumerTag
	}
}

func accessLogToEndpoint(
	tree common.SimpleURLTreeI,
) func(AccessLog) sharedDiscovery.Endpoint {
	return func(accessLog AccessLog) sharedDiscovery.Endpoint {
		normalizedAccessLog := common.NormalizeURL(tree, accessLog.URL)
		return sharedDiscovery.Endpoint{
			Method: accessLog.Method,
			URL:    normalizedAccessLog,
		}
	}
}

func extractInterceptorAgg(records []AccessLog) InterceptorAgg {
	maxTimestamp := lo.MaxBy(
		records,
		func(a, b AccessLog) bool { return a.Timestamp > b.Timestamp },
	).Timestamp

	return InterceptorAgg{
		Timestamp: maxTimestamp,
	}
}

func extractEndpointAgg(records []AccessLog) sharedDiscovery.EndpointAgg {
	minTime := lo.MinBy(
		records,
		func(a, b AccessLog) bool { return a.Timestamp < b.Timestamp },
	).Timestamp
	maxTime := lo.MaxBy(
		records,
		func(a, b AccessLog) bool { return a.Timestamp > b.Timestamp },
	).Timestamp

	statusCodes := countStatusCodes(records)

	count := len(records)
	var averageDuration, averageTotalDuration float32
	if count <= 0 {
		log.Warn().Msg("No records found, will set average duration to 0")
	} else {
		averageDuration = float32(lo.SumBy(
			records,
			func(accessLog AccessLog) int { return accessLog.Duration },
		)) / float32(count)

		averageTotalDuration = float32(lo.SumBy(
			records,
			func(accessLog AccessLog) int { return accessLog.TotalDuration },
		)) / float32(count)
	}

	return sharedDiscovery.EndpointAgg{
		MinTime:              minTime,
		MaxTime:              maxTime,
		Count:                sharedDiscovery.Count(count),
		StatusCodes:          statusCodes,
		AverageDuration:      averageDuration,
		AverageTotalDuration: averageTotalDuration,
	}
}

func countStatusCodes(records []AccessLog) map[int]sharedDiscovery.Count {
	res := make(map[int]sharedDiscovery.Count)
	for _, record := range records {
		res[record.StatusCode]++
	}

	return res
}
