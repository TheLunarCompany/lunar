package logging

import (
	"fmt"
	"lunar/toolkit-core/clock"
	"math"
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

type defaultWriter struct {
	logFileWriter *os.File
	consoleWriter zerolog.ConsoleWriter
	logLevel      zerolog.Level
}

func (d defaultWriter) Write(p []byte) (n int, err error) {
	_, err = d.logFileWriter.Write(p)
	if err != nil {
		return 0, err
	}
	return d.consoleWriter.Write(p)
}

func (d defaultWriter) WriteLevel(
	level zerolog.Level,
	payload []byte,
) (n int, err error) {
	if level < d.logLevel {
		return len(payload), nil
	}

	return d.Write(payload)
}

func ConfigureLogger(appName string, isTelemetryRequired bool,
	clock clock.Clock,
) *LunarTelemetryWriter {
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

	logLevel := getLogLevel()
	defaultWriter := defaultWriter{
		logFileWriter: logFile,
		consoleWriter: consoleWriter,
		logLevel:      logLevel,
	}

	var telemetryWriter *LunarTelemetryWriter
	var multi zerolog.LevelWriter
	if isTelemetryRequired && isTelemetryEnabled() {
		telemetryWriter = getTelemetryWriter(appName, clock)
		multi = zerolog.MultiLevelWriter(defaultWriter, telemetryWriter)
	} else {
		multi = zerolog.MultiLevelWriter(defaultWriter)
	}

	minimalLogLevel := zerolog.Level(math.Min(
		float64(logLevel),
		float64(getTelemetryLogLevel())),
	)

	logger := zerolog.New(multi).
		Level(minimalLogLevel).
		With().
		Timestamp().
		Str("app_name", appName).
		Logger()

	log.Logger = logger

	return telemetryWriter
}
