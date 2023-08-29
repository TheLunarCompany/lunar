package logging

import (
	"fmt"
	"lunar/toolkit-core/clock"
	"os"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"github.com/rs/zerolog/pkgerrors"
)

const (
	logFilePermission            = 200
	logDirectoryPermission       = 640
	logDirectoryPath             = "/var/log/lunar-proxy"
	logLevelEnvVar               = "LOG_LEVEL"
	TimeFieldFormatRFC3339Millis = "2006-01-02T15:04:05.999Z07:00"
)

func ConfigureLogger(appName string, isTelemetryRequired bool,
	clock clock.Clock,
) *LunarTelemetry {
	logLevel := getLogLevel()

	zerolog.TimeFieldFormat = TimeFieldFormatRFC3339Millis
	zerolog.ErrorStackMarshaler = pkgerrors.MarshalStack
	zerolog.ErrorStackFieldName = "traceback"

	//nolint:exhaustruct
	consoleWriter := zerolog.ConsoleWriter{
		Out:        os.Stdout,
		TimeFormat: TimeFieldFormatRFC3339Millis,
	}

	if _, err := os.Stat(logDirectoryPath); os.IsNotExist(err) {
		directoryCreationError := os.Mkdir(
			logDirectoryPath,
			logDirectoryPermission,
		)
		if directoryCreationError != nil {
			log.Warn().Stack().Err(directoryCreationError).
				Msgf("Error creating the logs directory")
		}
	}

	logFile, logFileErr := os.OpenFile(
		fmt.Sprintf("%s/%s.log", logDirectoryPath, appName),
		os.O_APPEND|os.O_CREATE|os.O_WRONLY,
		logFilePermission,
	)

	if logFileErr != nil {
		log.Error().
			Err(logFileErr).
			Msgf("could not open log file %v, will log to stdout only", appName)
	}

	multi := zerolog.MultiLevelWriter(consoleWriter, logFile)
	defaultLogger := zerolog.New(multi).
		Level(logLevel).
		With().
		Timestamp().
		Str("app_name", appName).
		Logger()

	log.Logger = defaultLogger

	if isTelemetryRequired && isTelemetryEnabled() {
		analytics := getTelemetryLogger(&defaultLogger, appName, clock)
		log.Logger = zerolog.New(nil).Hook(analytics).Output(nil)
		return analytics

	}

	return nil
}
