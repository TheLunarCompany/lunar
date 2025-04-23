package config

import (
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	engineBindPortEnvKey                      = "BIND_PORT"
	asyncServiceBindPortEnvKey                = "ASYNC_SERVICE_PORT"
	asyncServiceWorkersEnvKey                 = "ASYNC_SERVICE_WORKERS"
	AsyncServiceIdleSecEnvKey                 = "ASYNC_SERVICE_IDLE_SEC"
	asyncServiceRemoveCompletedRequestsEnvKey = "ASYNC_SERVICE_REMOVE_COMPLETED_REQUESTS_AFTER_MIN"
	asyncServiceRemoveRetrievedResponseEnvKey = "ASYNC_SERVICE_REMOVE_RETRIEVED_RESPONSE_AFTER_MIN"

	defaultAsyncServiceBindPort       = "8010"
	defaultEngineBindPort             = "8000"
	defaultWorkers                    = 10
	defaultIdleSec                    = 60
	defaultRemoveCompletedRequestsMin = 60
	defaultRemoveRetrievedResponseMin = 60
)

func GetEngineBindPort() string {
	port, err := GetEnv(engineBindPortEnvKey)
	if err != nil {
		log.Warn().Err(err).
			Msgf("Failed to get %s, using default port %s", engineBindPortEnvKey, defaultEngineBindPort)
		return defaultEngineBindPort
	}
	return port
}

func GetAsyncServiceRemoveCompletedRequests() time.Duration {
	removeCompletedRequests, err := GetEnvInt(asyncServiceRemoveCompletedRequestsEnvKey)
	if err != nil {
		defaultRemoveCompletedRequests := time.Duration(defaultRemoveCompletedRequestsMin) * time.Minute
		log.Warn().Err(err).
			Msgf("Failed to get %s, using default remove completed requests %d",
				asyncServiceRemoveCompletedRequestsEnvKey, defaultRemoveCompletedRequests)
		return defaultRemoveCompletedRequests
	}
	return time.Duration(removeCompletedRequests) * time.Second
}

func GetAsyncServiceRemoveRetrievedResponse() time.Duration {
	removeRetrievedResponse, err := GetEnvInt(asyncServiceRemoveRetrievedResponseEnvKey)
	if err != nil {
		defaultRemoveRetrievedResponse := time.Duration(defaultRemoveRetrievedResponseMin) * time.Minute
		log.Warn().Err(err).
			Msgf("Failed to get %s, using default remove retrieved response %d",
				asyncServiceRemoveRetrievedResponseEnvKey, defaultRemoveRetrievedResponse)
		return defaultRemoveRetrievedResponse
	}
	return time.Duration(removeRetrievedResponse) * time.Minute
}

func GetAsyncServiceBindPort() string {
	port, err := GetEnv(asyncServiceBindPortEnvKey)
	if err != nil {
		log.Warn().Err(err).
			Msgf("Failed to get %s, using default port %s",
				asyncServiceBindPortEnvKey, defaultAsyncServiceBindPort)
		return defaultAsyncServiceBindPort
	}
	return port
}

func GetAsyncServiceWorkers() int {
	workers, err := GetEnvInt(asyncServiceWorkersEnvKey)
	if err != nil {
		log.Warn().Err(err).
			Msgf("Failed to get %s, using default workers %d", asyncServiceWorkersEnvKey, defaultWorkers)
		return defaultWorkers
	}
	return workers
}

func GetAsyncServiceIdle() time.Duration {
	idle, err := GetEnvInt(AsyncServiceIdleSecEnvKey)
	if err != nil {
		idle = defaultIdleSec
		log.Warn().Err(err).
			Msgf("Failed to get %s, using default idle %d", AsyncServiceIdleSecEnvKey, defaultIdleSec)
	}

	return time.Duration(idle) * time.Second
}

func GetEnvInt(key string) (int, error) {
	val, err := GetEnv(key)
	if err != nil {
		return 0, err
	}
	intVal, err := strconv.Atoi(val)
	if err != nil {
		return 0, fmt.Errorf("failed to convert %s to int: %w", key, err)
	}
	return intVal, nil
}

func GetEnv(key string) (string, error) {
	val, exists := os.LookupEnv(key)
	if !exists {
		return "", fmt.Errorf("environment variable %s not set", key)
	}
	return val, nil
}
