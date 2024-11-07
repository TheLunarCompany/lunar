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
	proxyVersionEnvVar                 string = "LUNAR_VERSION"
	tenantNameEnvVar                   string = "TENANT_NAME"
	haproxyManageEndpointsPortEnvVar   string = "HAPROXY_MANAGE_ENDPOINTS_PORT"
	haproxyHealthcheckPortEnvVar       string = "LUNAR_HEALTHCHECK_PORT"
	redisURLEnvVar                     string = "REDIS_URL"
	redisUseCluster                    string = "REDIS_USE_CLUSTER"
	redisPrefix                        string = "REDIS_PREFIX"
	redisMaxRetryAttempts              string = "REDIS_MAX_RETRY_ATTEMPTS"
	redisRetryBackoffMillis            string = "REDIS_RETRY_BACKOFF_MILLIS"
	redisMaxOLRetryAttempts            string = "REDIS_MAX_OPTIMISTIC_LOCKING_RETRY_ATTEMPTS"
	lunarAPIKeyEnvVar                  string = "LUNAR_API_KEY"
	lunarHubURLEnvVar                  string = "LUNAR_HUB_URL"
	lunarHubReportIntervalEnvVar       string = "HUB_REPORT_INTERVAL"
	discoveryStateLocationEnvVar       string = "DISCOVERY_STATE_LOCATION"
	apiCallsMetricsStateLocationEnvVar string = "API_CALLS_METRICS_STATE_LOCATION"
	remedyStatsStateLocationEnvVar     string = "REMEDY_STATE_LOCATION"
	streamsFeatureFlagEnvVar           string = "LUNAR_STREAMS_ENABLED"
	streamsFlowsDirectoryEnvVar        string = "LUNAR_PROXY_FLOW_DIRECTORY"
	QuotasDirectoryEnvVar              string = "LUNAR_PROXY_QUOTAS_DIRECTORY"
	PathParamsDirectoryEnvVar          string = "LUNAR_FLOWS_PATH_PARAM_DIR"
	processorsDirectoryEnvVar          string = "LUNAR_PROXY_PROCESSORS_DIRECTORY"
	userProcessorsDirectoryEnvVar      string = "LUNAR_PROXY_USER_PROCESSORS_DIRECTORY"
	proxyConfigPath                    string = "LUNAR_PROXY_CONFIG"
	lunarEngineFailsafeEnableEnvVar    string = "LUNAR_ENGINE_FAILSAFE_ENABLED"
	lunarProxyBindPortEnvVar           string = "BIND_PORT"
	logLevelEnvVar                     string = "LOG_LEVEL"

	lunarHubDefaultValue string = "hub.lunar.dev"
)

func GetBindPort() string {
	return os.Getenv(lunarProxyBindPortEnvVar)
}

func GetLogLevel() string {
	return os.Getenv(logLevelEnvVar)
}

func GetTenantName() string {
	return os.Getenv(tenantNameEnvVar)
}

func IsEngineFailsafeEnabled() bool {
	return parseBooleanEnvVar(lunarEngineFailsafeEnableEnvVar)
}

func GetDiscoveryStateLocation() string {
	return os.Getenv(discoveryStateLocationEnvVar)
}

func GetAPICallsMetricsStateLocation() string {
	return os.Getenv(apiCallsMetricsStateLocationEnvVar)
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

func SetRedisURL(val string) string {
	prev := GetRedisURL()
	os.Setenv(redisURLEnvVar, val)
	return prev
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

func SetRedisUseCluster(val bool) bool {
	prev, _ := GetRedisUseCluster()
	os.Setenv(redisUseCluster, strconv.FormatBool(val))
	return prev
}

func GetRedisPrefix() string {
	return os.Getenv(redisPrefix)
}

func GetRedisMaxRetryAttempts() (int, error) {
	return strconv.Atoi(os.Getenv(redisMaxRetryAttempts))
}

func SetRedisMaxRetryAttempts(val int) int {
	prev, _ := GetRedisMaxRetryAttempts()
	os.Setenv(redisMaxRetryAttempts, strconv.Itoa(val))
	return prev
}

func GetRedisRetryBackoffTime() (time.Duration, error) {
	millis, err := strconv.Atoi(os.Getenv(redisRetryBackoffMillis))
	if err != nil {
		return 0, err
	}
	return time.Millisecond * time.Duration(millis), nil
}

func SetRedisRetryBackoffTime(val time.Duration) time.Duration {
	prev, _ := GetRedisRetryBackoffTime()
	os.Setenv(redisRetryBackoffMillis, strconv.Itoa(int(val.Milliseconds())))
	return prev
}

func GetRedisMaxOLRetryAttempts() (int, error) {
	return strconv.Atoi(os.Getenv(redisMaxOLRetryAttempts))
}

func SetRedisMaxOLRetryAttempts(val int) int {
	prev, _ := GetRedisMaxOLRetryAttempts()
	os.Setenv(redisMaxOLRetryAttempts, strconv.Itoa(val))
	return prev
}

func GetRedisUseClientCertificate() bool {
	return parseBooleanEnvVar("REDIS_USE_CLIENT_CERT")
}

func GetRedisClientCertificatePath() string {
	return os.Getenv("REDIS_CLIENT_CERT_PATH")
}

func GetRedisClientKeyPath() string {
	return os.Getenv("REDIS_CLIENT_KEY_PATH")
}

func GetRedisUseCACertificate() bool {
	return parseBooleanEnvVar("REDIS_USE_CA_CERT")
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

func SetQuotasDirectory(dir string) string {
	prevVal := GetQuotasDirectory()
	os.Setenv(QuotasDirectoryEnvVar, dir)
	return prevVal
}

func GetQuotasDirectory() string {
	return os.Getenv(QuotasDirectoryEnvVar)
}

func GetPathParamsDirectory() string {
	return os.Getenv(PathParamsDirectoryEnvVar)
}

func SetPathParamsDirectory(dir string) string {
	prevVal := GetPathParamsDirectory()
	os.Setenv(PathParamsDirectoryEnvVar, dir)
	return prevVal
}

func SetProcessorsDirectory(dir string) string {
	prevVal := GetProcessorsDirectory()
	os.Setenv(processorsDirectoryEnvVar, dir)
	return prevVal
}

func UnsetProcessorsDirectory() {
	os.Unsetenv(processorsDirectoryEnvVar)
}

func GetGatewayConfigPath() string {
	return os.Getenv(proxyConfigPath)
}

func parseBooleanEnvVar(envVar string) bool {
	raw := os.Getenv(envVar)
	if raw == "true" {
		return true
	}
	if raw == "false" {
		return false
	}
	log.Warn().Msgf("%s must be either `true` or `false`", envVar)
	return false
}
