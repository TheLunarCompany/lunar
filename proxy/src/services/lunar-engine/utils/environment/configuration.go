package environment

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

const (
	tenantNameEnvVar                 string = "TENANT_NAME"
	haproxyManageEndpointsPortEnvVar string = "HAPROXY_MANAGE_ENDPOINTS_PORT"
	haproxyHealthcheckPortEnvVar     string = "LUNAR_HEALTHCHECK_PORT"
	redisURLEnvVar                   string = "REDIS_URL"
	redisUseCluster                  string = "REDIS_USE_CLUSTER"
	redisPrefix                      string = "REDIS_PREFIX"
	redisMaxRetryAttempts            string = "REDIS_MAX_RETRY_ATTEMPTS"
	redisRetryBackoffMillis          string = "REDIS_RETRY_BACKOFF_MILLIS"
	redisMaxOLRetryAttempts          string = "REDIS_MAX_OPTIMISTIC_LOCKING_RETRY_ATTEMPTS" //nolint:lll
	lunarAPIKeyEnvVar                string = "LUNAR_API_KEY"
	lunarHubURLEnvVar                string = "LUNAR_HUB_URL"
	lunarHubReportIntervalEnvVar     string = "HUB_REPORT_INTERVAL"
	discoveryStateLocationEnvVar     string = "DISCOVERY_STATE_LOCATION"
	remedyStatsStateLocationEnvVar   string = "REMEDY_STATE_LOCATION"
)

func GetTenantName() string {
	return os.Getenv(tenantNameEnvVar)
}

func GetDiscoveryStateLocation() string {
	return os.Getenv(discoveryStateLocationEnvVar)
}

func GetRemedyStateLocation() string {
	return os.Getenv(remedyStatsStateLocationEnvVar)
}

func GetManageEndpointsPort() string {
	return os.Getenv(haproxyManageEndpointsPortEnvVar)
}

func GetHAProxyHealthcheckPort() string {
	return os.Getenv(haproxyHealthcheckPortEnvVar)
}

func GetRedisURL() string {
	return os.Getenv(redisURLEnvVar)
}

func GetRedisUseCluster() (bool, error) {
	raw := os.Getenv(redisUseCluster)
	if raw == "true" {
		return true, nil
	}
	if raw == "false" {
		return false, nil
	}
	return false, fmt.Errorf(
		"%s must be either `true` or `false`",
		redisUseCluster,
	)
}

func GetRedisPrefix() string {
	return os.Getenv(redisPrefix)
}

func GetRedisMaxRetryAttempts() (int, error) {
	return strconv.Atoi(os.Getenv(redisMaxRetryAttempts))
}

func GetRedisRetryBackoffTime() (time.Duration, error) {
	millis, err := strconv.Atoi(os.Getenv(redisRetryBackoffMillis))
	if err != nil {
		return 0, err
	}
	return time.Millisecond * time.Duration(millis), nil
}

func GetRedisMaxOLRetryAttempts() (int, error) {
	return strconv.Atoi(os.Getenv(redisMaxOLRetryAttempts))
}

func GetHubURL() string {
	return os.Getenv(lunarHubURLEnvVar)
}

func GetAPIKey() string {
	return os.Getenv(lunarAPIKeyEnvVar)
}

func GetHubReportInterval() (int, error) {
	return strconv.Atoi(os.Getenv(lunarHubReportIntervalEnvVar))
}

func IsLogLevelDebug() bool {
	return log.Logger.GetLevel() == zerolog.DebugLevel
}
