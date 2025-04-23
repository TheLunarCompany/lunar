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
