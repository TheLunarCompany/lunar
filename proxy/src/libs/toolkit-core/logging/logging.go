package logging

import (
	"context"
	"encoding/json"
	"fmt"
	"lunar/toolkit-core/clock"
	"math"
	"os"
	"reflect"

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

type (
	onPanicFuncType func() error
	defaultWriter   struct {
		logFileWriter *os.File
		consoleWriter zerolog.ConsoleWriter
		logLevel      zerolog.Level
	}
)

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

type panicHook struct {
	onPanicFunc onPanicFuncType
}

func getKeyFromBuffer(buf []byte, key string) (interface{}, error) {
	var result map[string]interface{}

	err := json.Unmarshal(buf, &result)
	if err != nil {
		return nil, err
	}

	if val, exists := result[key]; exists {
		return val, nil
	}
	return nil, fmt.Errorf("key %s not found", key)
}

func (h panicHook) Run(event *zerolog.Event, level zerolog.Level, msg string) {
	if level == zerolog.PanicLevel || level == zerolog.FatalLevel {
		err := h.onPanicFunc()
		if err != nil {
			log.Error().Err(err).Msg("Error executing onPanicFunc")
		}

		eventValue := reflect.ValueOf(event).Elem()
		bufField := eventValue.FieldByName("buf")
		panicLogger := log.Error()

		if bufField.IsValid() {
			eventBuffer := bufField.Bytes()
			eventBuffer = append(eventBuffer, []byte("}")...) // Add the closing bracket
			errorFromEvent, err := getKeyFromBuffer(eventBuffer, "error")
			if err == nil {
				panicLogger = panicLogger.Any("error", errorFromEvent)
			}
		}

		panicLogger.Msgf("Panic detected, Stopping Lunar Engine. Error: %s", msg)
		log.Error().
			Msgf("Panic detected, Stopping Lunar Engine. Error: %s", msg)
		_, cancel := context.WithCancel(context.Background())
		cancel()
		os.Exit(0) // We exit the process after a panic to avoid a wrong state
	}
}

func SetLoggerOnPanicCustomFunc(onPanicFunc onPanicFuncType) {
	if onPanicFunc != nil {
		hook := zerolog.NewLevelHook()
		hook.PanicHook = panicHook{onPanicFunc: onPanicFunc}
		hook.FatalHook = panicHook{onPanicFunc: onPanicFunc}
		log.Logger = log.Logger.Hook(hook)
	}
}

func ConfigureLogger(
	appName string,
	isTelemetryRequired bool,
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
	defaultWriterObj := defaultWriter{
		logFileWriter: logFile,
		consoleWriter: consoleWriter,
		logLevel:      logLevel,
	}

	var telemetryWriter *LunarTelemetryWriter
	var multi zerolog.LevelWriter
	if isTelemetryRequired && isTelemetryEnabled() {
		telemetryWriter = getTelemetryWriter(appName, clock)
		multi = zerolog.MultiLevelWriter(defaultWriterObj, telemetryWriter)
	} else {
		multi = zerolog.MultiLevelWriter(defaultWriterObj)
	}

	minimalLogLevel := zerolog.Level(math.Min(
		float64(logLevel),
		float64(getTelemetryLogLevel())),
	)

	logger := zerolog.New(multi).
		Level(minimalLogLevel).
		With().
		Timestamp().
		Stack().
		Str("app_name", appName).
		Logger()

	log.Logger = logger

	return telemetryWriter
}
