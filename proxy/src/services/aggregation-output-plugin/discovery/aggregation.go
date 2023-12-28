package discovery

import (
	"lunar/aggregation-plugin/common"
	"strings"

	"github.com/rs/zerolog/log"
	"github.com/samber/lo"
)

const (
	lunarInterceptorHeaderDelimiter = "/"
	unknownLunarInterceptor         = "unknown"
)

func ExtractAggs(
	records []AccessLog,
	tree common.SimpleURLTreeI,
) Agg {
	byEndpoint := lo.GroupBy(records, accessLogToEndpoint(tree))
	byInterceptor := lo.GroupBy(records, accessLogToInterceptor())

	return Agg{
		Endpoints: lo.MapValues(
			byEndpoint,
			func(accessLogs []AccessLog,
				_ common.Endpoint,
			) EndpointAgg {
				return extractEndpointAgg(accessLogs)
			},
		),
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

func accessLogToEndpoint(
	tree common.SimpleURLTreeI,
) func(AccessLog) common.Endpoint {
	return func(accessLog AccessLog) common.Endpoint {
		normalizedAccessLog := common.NormalizeURL(tree, accessLog.URL)
		return common.Endpoint{
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

func extractEndpointAgg(records []AccessLog) EndpointAgg {
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
	var averageDuration float32
	if count <= 0 {
		log.Warn().Msg("No records found, will set average duration to 0")
	} else {
		averageDuration = float32(lo.SumBy(
			records,
			func(accessLog AccessLog) int { return accessLog.Duration },
		)) / float32(count)
	}

	return EndpointAgg{
		MinTime:         minTime,
		MaxTime:         maxTime,
		Count:           Count(count),
		StatusCodes:     statusCodes,
		AverageDuration: averageDuration,
	}
}

func countStatusCodes(records []AccessLog) map[int]Count {
	res := make(map[int]Count)
	for _, record := range records {
		res[record.StatusCode]++
	}

	return res
}
