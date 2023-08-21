package logging

import (
	"os"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

const (
	telemetricServerPortEnvVar string = "LUNAR_TELEMETRY_SERVER_PORT"
	telemetricEnabledKey       string = "LUNAR_TELEMETRY"
	telemetricLogLevelEnvVar   string = "LUNAR_TELEMETRY_LOG_LEVEL"
)

func getTelemetricServerPort() string {
	return os.Getenv(telemetricServerPortEnvVar)
}

func getTelemetricEnableStatus() string {
	return os.Getenv(telemetricEnabledKey)
}

func getTelemetricsLogLevel() zerolog.Level {
	return parseLogLevelFromEnvValue(
		telemetricLogLevelEnvVar, zerolog.InfoLevel)
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
