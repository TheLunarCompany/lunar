package logging

import (
	"lunar/toolkit-core/client"
	"lunar/toolkit-core/clock"
	"net"
	"net/http"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

const (
	telemetryEnabled                 string = "true"
	timesToRetry                     int    = 10
	timeToWaitBetweenRetriesInMillis int    = 250
)

var (
	telemetryDestinationPort      = getTelemetryServerPort()
	telemetryServerHealthcheckURL = "http://localhost:2020"
	telemetryDestination          = "localhost:" + telemetryDestinationPort
)

type LunarTelemetry struct {
	defaultLogger   *zerolog.Logger
	telemetryLogger *zerolog.Logger
	udpConnection   *net.Conn
}

func (l LunarTelemetry) Run(_ *zerolog.Event,
	level zerolog.Level, msg string,
) {
	l.defaultLogger.WithLevel(level).Msg(msg)
	l.telemetryLogger.WithLevel(level).Msg(prepareTelemetryLog(msg))
}

func (l LunarTelemetry) Close() {
	log.Info().Msg("Closing Telemetry UDP connection")
	if l.udpConnection == nil {
		return
	}

	(*l.udpConnection).Close()
}

func waitForHealthcheck(clock clock.Clock) error {
	retryConfig := client.RetryConfig{ //nolint:exhaustruct
		Attempts:    timesToRetry,
		SleepMillis: timeToWaitBetweenRetriesInMillis,
	}

	healthcheckConfig := client.HealthcheckConfig{
		URL:             telemetryServerHealthcheckURL,
		BodyPredicate:   func(_ []byte) bool { return true },
		StatusPredicate: func(code int) bool { return code == 200 },
		HTTPClient:      http.DefaultClient,
	}
	return client.WaitForHealthcheck(clock, &retryConfig, &healthcheckConfig)
}

func isTelemetryEnabled() bool {
	if getTelemetryEnabledStatus() != telemetryEnabled {
		log.Info().Msg("Lunar Telemetry has been disabled.")
		return false
	}
	return true
}

func getTelemetryLogger(defaultLogger *zerolog.Logger,
	appName string,
	clock clock.Clock,
) *LunarTelemetry {
	udpConn, err := net.Dial("udp", telemetryDestination)
	if err != nil {
		log.Trace().Err(err).Msg("Failed to create UDP connection.")
		return nil
	}

	_ = waitForHealthcheck(clock)

	telemetryLogLevel := getTelemetryLogLevel()
	telemetryLogger := zerolog.New(udpConn).
		Level(telemetryLogLevel).With().Timestamp().Str("app_name", appName).Logger()

	telemetry := LunarTelemetry{
		defaultLogger,
		&telemetryLogger,
		&udpConn,
	}
	return &telemetry
}

func prepareTelemetryLog(logMessage string) string {
	// TODO: Here we should add logic to remove PII׳s
	// and add additional Telemetry information.
	return logMessage
}
