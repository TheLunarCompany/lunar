package environment

import (
	"os"
	"strconv"
	"time"
)

const (
	tenantNameEnvVar                 string = "TENANT_NAME"
	haproxyManageEndpointsPortEnvVar string = "HAPROXY_MANAGE_ENDPOINTS_PORT"
	haproxyHealthcheckPortEnvVar     string = "LUNAR_HEALTHCHECK_PORT"
	redisURLEnvVar                   string = "REDIS_URL"
	redisPrefix                      string = "REDIS_PREFIX"
	redisMaxRetryAttempts            string = "REDIS_MAX_RETRY_ATTEMPTS"
	redisRetryBackoffMillis          string = "REDIS_RETRY_BACKOFF_MILLIS"
	redisMaxOLRetryAttempts          string = "REDIS_MAX_OPTIMISTIC_LOCKING_RETRY_ATTEMPTS" //nolint:lll
)

func GetTenantName() string {
	return os.Getenv(tenantNameEnvVar)
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
