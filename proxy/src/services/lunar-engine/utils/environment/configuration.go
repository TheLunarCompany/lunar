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
	proxyVersionEnvVar               string = "LUNAR_VERSION"
	tenantNameEnvVar                 string = "TENANT_NAME"
	haproxyManageEndpointsPortEnvVar string = "HAPROXY_MANAGE_ENDPOINTS_PORT"
	haproxyHealthcheckPortEnvVar     string = "LUNAR_HEALTHCHECK_PORT"
	redisURLEnvVar                   string = "REDIS_URL"
	redisUseCluster                  string = "REDIS_USE_CLUSTER"
	redisPrefix                      string = "REDIS_PREFIX"
	redisMaxRetryAttempts            string = "REDIS_MAX_RETRY_ATTEMPTS"
	redisRetryBackoffMillis          string = "REDIS_RETRY_BACKOFF_MILLIS"
	redisMaxOLRetryAttempts          string = "REDIS_MAX_OPTIMISTIC_LOCKING_RETRY_ATTEMPTS"
	lunarAPIKeyEnvVar                string = "LUNAR_API_KEY"
	lunarHubURLEnvVar                string = "LUNAR_HUB_URL"
	lunarHubReportIntervalEnvVar     string = "HUB_REPORT_INTERVAL"
	discoveryStateLocationEnvVar     string = "DISCOVERY_STATE_LOCATION"
	remedyStatsStateLocationEnvVar   string = "REMEDY_STATE_LOCATION"
	streamsFeatureFlagEnvVar         string = "LUNAR_STREAMS_ENABLED"
	streamsFlowsDirectoryEnvVar      string = "LUNAR_PROXY_FLOW_DIRECTORY"
	ResourcesDirectoryEnvVar         string = "LUNAR_PROXY_RESOURCES_DIRECTORY"
	processorsDirectoryEnvVar        string = "LUNAR_PROXY_PROCESSORS_DIRECTORY"
	userProcessorsDirectoryEnvVar    string = "LUNAR_PROXY_USER_PROCESSORS_DIRECTORY"

	lunarHubDefaultValue string = "hub.lunar.dev"
)

func GetTenantName() string {
	return os.Getenv(tenantNameEnvVar)
}

func GetDiscoveryStateLocation() string {
	return os.Getenv(discoveryStateLocationEnvVar)
}

func GetProxyVersion() string {
	return os.Getenv(proxyVersionEnvVar)
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

func GetRedisUseClientCertificate() bool {
	raw := os.Getenv("REDIS_USE_CLIENT_CERT")
	if raw == "true" {
		return true
	}
	if raw == "false" {
		return false
	}
	log.Warn().Msgf(
		"REDIS_USE_CLIENT_CERT must be either `true` or `false`, using default: false")
	return false
}

func GetRedisClientCertificatePath() string {
	return os.Getenv("REDIS_CLIENT_CERT_PATH")
}

func GetRedisClientKeyPath() string {
	return os.Getenv("REDIS_CLIENT_KEY_PATH")
}

func GetRedisUseCACertificate() bool {
	raw := os.Getenv("REDIS_USE_CA_CERT")
	if raw == "true" {
		return true
	}
	if raw == "false" {
		return false
	}
	log.Warn().Msgf(
		"REDIS_USE_CA_CERT must be either `true` or `false`, using default: false")
	return false
}

func GetRedisCACertificatePath() string {
	return os.Getenv("REDIS_CA_CERT_PATH")
}

func GetHubURL() string {
	lunarHubURL := os.Getenv(lunarHubURLEnvVar)
	if lunarHubURL == "" {
		log.Warn().Msgf("Could not find Lunar Hub URL from ENV, using default: %s", lunarHubDefaultValue)
		lunarHubURL = lunarHubDefaultValue
	}
	return lunarHubURL
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

func IsStreamsEnabled() bool {
	return os.Getenv(streamsFeatureFlagEnvVar) == "true"
}

func GetStreamsFlowsDirectory() string {
	return os.Getenv(streamsFlowsDirectoryEnvVar)
}

func SetStreamsFlowsDirectory(dir string) string {
	prevVal := GetStreamsFlowsDirectory()
	os.Setenv(streamsFlowsDirectoryEnvVar, dir)
	return prevVal
}

func GetUserProcessorsDirectory() string {
	return os.Getenv(userProcessorsDirectoryEnvVar)
}

func GetProcessorsDirectory() string {
	return os.Getenv(processorsDirectoryEnvVar)
}

func GetResourcesDirectory() string {
	return os.Getenv(ResourcesDirectoryEnvVar)
}

func SetProcessorsDirectory(dir string) string {
	prevVal := GetProcessorsDirectory()
	os.Setenv(processorsDirectoryEnvVar, dir)
	return prevVal
}

func UnsetProcessorsDirectory() {
	os.Unsetenv(processorsDirectoryEnvVar)
}
