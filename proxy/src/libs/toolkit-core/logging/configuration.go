package logging

import (
	"os"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

const (
	telemetryServerPortEnvVar string = "LUNAR_TELEMETRY_SERVER_PORT"
	telemetryEnabledKey       string = "LUNAR_TELEMETRY"
	telemetryLogLevelEnvVar   string = "LUNAR_TELEMETRY_LOG_LEVEL"
	telemetryServerHostEnvVar string = "LUNAR_TELEMETRY_SERVER_HOST"
	
	criticalMessagesServerPortEnvVar string = "LUNAR_CRITICAL_MESSAGES_SERVER_PORT"
	criticalMessagesLogLevelEnvVar   string = "LUNAR_CRITICAL_MESSAGES_LOG_LEVEL"
)

func getTelemetryServerHost() string {
	return os.Getenv(telemetryServerHostEnvVar)
}

func getTelemetryServerPort() string {
	return os.Getenv(telemetryServerPortEnvVar)
}

func getTelemetryEnabledStatus() string {
	return os.Getenv(telemetryEnabledKey)
}

func getTelemetryLogLevel() zerolog.Level {
	return parseLogLevelFromEnvValue(
		telemetryLogLevelEnvVar, zerolog.InfoLevel)
}

func getCriticalMessagesServerPort() string {
	return os.Getenv(criticalMessagesServerPortEnvVar)
}


func getCriticalMessagesLogLevel() zerolog.Level {
	return parseLogLevelFromEnvValue(
		criticalMessagesLogLevelEnvVar, zerolog.ErrorLevel)
}

func getLogLevel() zerolog.Level {
	return parseLogLevelFromEnvValue(logLevelEnvVar, zerolog.ErrorLevel)
}

func parseLogLevelFromEnvValue(
	envVarName string,
	defaultLogLevel zerolog.Level,
) zerolog.Level {
	levelString := os.Getenv(envVarName)
	level, err := zerolog.ParseLevel(levelString)
	if err != nil {
		log.Warn().Msgf(
			"Unknown log level [%v] in environment variable %v, "+
				"setting log level to [%v]",
			levelString, envVarName, defaultLogLevel.String())
		return defaultLogLevel
	}
	return level
}
