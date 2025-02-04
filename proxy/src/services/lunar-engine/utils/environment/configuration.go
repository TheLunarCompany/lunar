//nolint:lll
package environment

import (
	"fmt"
	"lunar/toolkit-core/configuration"
	"os"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

const (
	proxyVersionEnvVar                                        string = "LUNAR_VERSION"
	tenantNameEnvVar                                          string = "TENANT_NAME"
	haproxyManageEndpointsPortEnvVar                          string = "HAPROXY_MANAGE_ENDPOINTS_PORT"
	haproxyHealthcheckPortEnvVar                              string = "LUNAR_HEALTHCHECK_PORT"
	redisURLEnvVar                                            string = "REDIS_URL"
	redisUseCluster                                           string = "REDIS_USE_CLUSTER"
	redisPrefix                                               string = "REDIS_PREFIX"
	redisMaxRetryAttempts                                     string = "REDIS_MAX_RETRY_ATTEMPTS"
	redisRetryBackoffMillis                                   string = "REDIS_RETRY_BACKOFF_MILLIS"
	redisMaxOLRetryAttempts                                   string = "REDIS_MAX_OPTIMISTIC_LOCKING_RETRY_ATTEMPTS" //nolint: lll
	lunarAPIKeyEnvVar                                         string = "LUNAR_API_KEY"
	lunarHubURLEnvVar                                         string = "LUNAR_HUB_URL"
	lunarHubSchemeEnvVar                                      string = "LUNAR_HUB_SCHEME"
	lunarHubReportIntervalEnvVar                              string = "HUB_REPORT_INTERVAL"
	lunarHubInitialWaitTimeBetweenConnectionAttemptsSecEnvVar string = "LUNAR_HUB_INITIAL_WAIT_TIME_BETWEEN_CONNECTION_ATTEMPTS_SEC"
	lunarHubMaxWaitTimeBetweenConnectionAttemptsSecEnvVar     string = "LUNAR_HUB_MAX_WAIT_TIME_BETWEEN_CONNECTION_ATTEMPTS_SEC"
	lunarHubConnectionAttemptsPerWaitTimeEnvVar               string = "LUNAR_HUB_CONNECTION_ATTEMPTS_PER_WAIT_TIME"
	lunarHubConnectionAttemptsWaitTimeExponentialGrowthEnvVar string = "LUNAR_HUB_CONNECTION_ATTEMPTS_WAIT_TIME_EXPONENTIAL_GROWTH"
	discoveryStateLocationEnvVar                              string = "DISCOVERY_STATE_LOCATION"
	apiCallsMetricsStateLocationEnvVar                        string = "API_CALLS_METRICS_STATE_LOCATION"
	remedyStatsStateLocationEnvVar                            string = "REMEDY_STATE_LOCATION"
	streamsFeatureFlagEnvVar                                  string = "LUNAR_STREAMS_ENABLED"
	streamsFlowsDirectoryEnvVar                               string = "LUNAR_PROXY_FLOW_DIRECTORY"
	QuotasDirectoryEnvVar                                     string = "LUNAR_PROXY_QUOTAS_DIRECTORY"
	PathParamsDirectoryEnvVar                                 string = "LUNAR_FLOWS_PATH_PARAM_DIR"
	processorsDirectoryEnvVar                                 string = "LUNAR_PROXY_PROCESSORS_DIRECTORY"
	userProcessorsDirectoryEnvVar                             string = "LUNAR_PROXY_USER_PROCESSORS_DIRECTORY"
	proxyConfigPath                                           string = "LUNAR_PROXY_CONFIG"
	lunarEngineFailsafeEnableEnvVar                           string = "LUNAR_ENGINE_FAILSAFE_ENABLED"
	lunarProxyBindPortEnvVar                                  string = "BIND_PORT"
	logLevelEnvVar                                            string = "LOG_LEVEL"
	lunarGatewayInstanceIDEnvVar                              string = "GATEWAY_INSTANCE_ID"
	diagnosisFailsafeMinSecBetweenCallsEnvVar                 string = "DIAGNOSIS_FAILSAFE_MIN_SEC_BETWEEN_CALLS"
	diagnosisFailsafeConsecutiveNEnvVar                       string = "DIAGNOSIS_FAILSAFE_CONSECUTIVE_N"
	diagnosisFailsafeMinStableSecEnvVar                       string = "DIAGNOSIS_FAILSAFE_MIN_STABLE_SEC"
	diagnosisFailsafeCooldownSecEnvVar                        string = "DIAGNOSIS_FAILSAFE_COOLDOWN_SEC"
	diagnosisFailsafeHealthySessionRateEnvVar                 string = "DIAGNOSIS_FAILSAFE_HEALTHY_SESSION_RATE"
	diagnosisFailsafeHealthyMaxLastSessionSecEnvVar           string = "DIAGNOSIS_FAILSAFE_HEALTHY_MAX_LAST_SESSION_SEC"
	concurrentStrategyResetInterval                           string = "CONCURRENT_STRATEGY_RESET_INTERVAL"
	doctorReportIntervalMinutesEnvVar                         string = "DOCTOR_REPORT_INTERVAL_MINUTES"
	spoeProcessingTimeoutSecEnvVar                            string = "LUNAR_SPOE_PROCESSING_TIMEOUT_SEC"
	LuaRetryRequestTimeoutSecEnvVar                           string = "LUNAR_RETRY_REQUEST_TIMEOUT_SEC"
	lunarAccessLogMetricsCollectTimeIntervalEnvVar            string = "LUNAR_ACCESS_LOG_METRICS_COLLECTION_TIME_INTERVAL_SEC"
	MetricsConfigFilePathEnvVar                               string = "LUNAR_PROXY_METRICS_CONFIG"
	MetricsConfigFileDefaultPathEnvVar                        string = "LUNAR_PROXY_METRICS_CONFIG_DEFAULT"

	FlowsFolder      string = "flows"
	PathParamsFolder string = "path_params"
	QuotasFolder     string = "quotas"
	GatewayConfig    string = "gateway_config.yaml"

	lunarHubDefaultValue        string = "hub.lunar.dev"
	lunarHubSchemeDefaultValue  string = "wss"
	DoctorReportIntervalDefault        = 2 * time.Minute
	spoeServerTimeoutDefault           = 60 * time.Second

	accessLogMetricsCollectTimeIntervalSecDefault = 5
)

func GetAccessLogMetricsCollectTimeInterval() time.Duration {
	raw := os.Getenv(lunarAccessLogMetricsCollectTimeIntervalEnvVar)
	if raw == "" {
		return time.Second * accessLogMetricsCollectTimeIntervalSecDefault
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil {
		return time.Second * accessLogMetricsCollectTimeIntervalSecDefault
	}
	return time.Second * time.Duration(seconds)
}

func GetLuaRetryRequestTimeout() (time.Duration, error) {
	raw := os.Getenv(LuaRetryRequestTimeoutSecEnvVar)
	if raw == "" {
		return 0, fmt.Errorf("%s must be set", LuaRetryRequestTimeoutSecEnvVar)
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil {
		return 0, err
	}
	return time.Second * time.Duration(seconds), nil
}

func GetCustomFlowsDirectory(root string) string {
	return path.Join(root, FlowsFolder)
}

func GetCustomPathParamsDirectory(root string) string {
	return path.Join(root, PathParamsFolder)
}

func GetCustomQuotasDirectory(root string) string {
	return path.Join(root, QuotasFolder)
}

func GetCustomGatewayConfigPath(root string) string {
	return path.Join(root, GatewayConfig)
}

func GetSpoeProcessingTimeout() (time.Duration, error) {
	raw := os.Getenv(spoeProcessingTimeoutSecEnvVar)
	if raw == "" {
		return 0, fmt.Errorf("%s must be set", spoeProcessingTimeoutSecEnvVar)
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil {
		return 0, err
	}
	return time.Second * time.Duration(seconds), nil
}

func GetGatewayInstanceID() string {
	return strings.TrimSuffix(os.Getenv(lunarGatewayInstanceIDEnvVar), "\n")
}

func GetConcurrentStrategyResetInterval() (int, error) {
	resetInterval := os.Getenv(concurrentStrategyResetInterval)
	if resetInterval == "" {
		return 0, fmt.Errorf("CONCURRENT_STRATEGY_RESET_INTERVAL is not set")
	}
	val, err := strconv.Atoi(resetInterval)
	return val, err
}

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

func SetDiscoveryStateLocation(val string) string {
	prev := GetDiscoveryStateLocation()
	os.Setenv(discoveryStateLocationEnvVar, val)
	return prev
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
		log.Warn().
			Msgf("Could not find Lunar Hub URL from ENV, using default: %s", lunarHubDefaultValue)
		lunarHubURL = lunarHubDefaultValue
	}
	return lunarHubURL
}

func GetHubScheme() string {
	lunarHubScheme := os.Getenv(lunarHubSchemeEnvVar)
	if lunarHubScheme == "" {
		log.Warn().
			Msgf("Could not find Lunar Hub Scheme from ENV, using default: %s", lunarHubSchemeDefaultValue)
		lunarHubScheme = lunarHubSchemeDefaultValue
	}
	return lunarHubScheme
}

func GetHubInitialWaitTimeBetweenConnectionAttempts(fallback time.Duration) time.Duration {
	raw := os.Getenv(lunarHubInitialWaitTimeBetweenConnectionAttemptsSecEnvVar)
	if raw == "" {
		return fallback
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return time.Second * time.Duration(seconds)
}

func GetHubMaxWaitTimeBetweenConnectionAttempts(fallback time.Duration) time.Duration {
	raw := os.Getenv(lunarHubMaxWaitTimeBetweenConnectionAttemptsSecEnvVar)
	if raw == "" {
		return fallback
	}
	seconds, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return time.Second * time.Duration(seconds)
}

func GetHubConnectionAttemptsPerWaitTime(fallback int) int {
	raw := os.Getenv(lunarHubConnectionAttemptsPerWaitTimeEnvVar)
	if raw == "" {
		return fallback
	}
	val, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return val
}

func GetHubConnectionAttemptsWaitTimeExponentialGrowth(fallback int) int {
	raw := os.Getenv(lunarHubConnectionAttemptsWaitTimeExponentialGrowthEnvVar)
	if raw == "" {
		return fallback
	}
	val, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return val
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

func GetMetricsConfigFilePath() string {
	filePath := os.Getenv(MetricsConfigFilePathEnvVar)

	_, err := os.Stat(filePath)
	if err == nil {
		return filePath
	}

	internalPath, _ := configuration.GetPathFromEnvVarOrDefault(
		MetricsConfigFileDefaultPathEnvVar,
		"./metrics.yaml",
	)
	return internalPath
}

func SetMetricsConfigFilePath(val string) string {
	prevVal := GetMetricsConfigFilePath()
	os.Setenv(MetricsConfigFilePathEnvVar, val)
	return prevVal
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

func GetDiagnosisFailsafeMinTimeBetweenCalls() (time.Duration, error) {
	raw, err := strconv.Atoi(os.Getenv(diagnosisFailsafeMinSecBetweenCallsEnvVar))
	if err != nil {
		return 0, err
	}
	return time.Second * time.Duration(raw), nil
}

func GetDiagnosisFailsafeConsecutiveN() (int, error) {
	return strconv.Atoi(os.Getenv(diagnosisFailsafeConsecutiveNEnvVar))
}

func GetDiagnosisFailsafeMinStablePeriod() (time.Duration, error) {
	raw, err := strconv.Atoi(os.Getenv(diagnosisFailsafeMinStableSecEnvVar))
	if err != nil {
		return 0, err
	}
	return time.Second * time.Duration(raw), nil
}

func GetDiagnosisFailsafeCooldownPeriod() (time.Duration, error) {
	raw, err := strconv.Atoi(os.Getenv(diagnosisFailsafeCooldownSecEnvVar))
	if err != nil {
		return 0, err
	}
	return time.Second * time.Duration(raw), nil
}

func GetDiagnosisFailsafeHealthySessionRate() (int, error) {
	return strconv.Atoi(os.Getenv(diagnosisFailsafeHealthySessionRateEnvVar))
}

func GetDiagnosisFailsafeHealthyMaxLastSession() (time.Duration, error) {
	raw, err := strconv.Atoi(os.Getenv(diagnosisFailsafeHealthyMaxLastSessionSecEnvVar))
	if err != nil {
		return 0, err
	}
	return time.Second * time.Duration(raw), nil
}

func GetDoctorReportInterval() (time.Duration, error) {
	raw := os.Getenv(doctorReportIntervalMinutesEnvVar)
	if raw == "" {
		return 0, fmt.Errorf("%s must be set", doctorReportIntervalMinutesEnvVar)
	}
	minutes, err := strconv.Atoi(raw)
	if err != nil {
		return 0, err
	}
	return time.Minute * time.Duration(minutes), nil
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
