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
	telemetricEnable                 string = "true"
	timesToRetry                     int    = 10
	timeToWaitBetweenRetriesInMillis int    = 250
)

var (
	telemetricDestinationPort      = getTelemetricServerPort()
	telemetricServerHealthcheckURL = "http://localhost:2020"
	telemetricDestination          = "localhost:" + telemetricDestinationPort
)

type LunarTelemetric struct {
	defaultLogger    *zerolog.Logger
	telemetricLogger *zerolog.Logger
	udpConnection    *net.Conn
}

func (l LunarTelemetric) Run(_ *zerolog.Event,
	level zerolog.Level, msg string,
) {
	l.defaultLogger.WithLevel(level).Msg(msg)
	l.telemetricLogger.WithLevel(level).Msg(prepareTelemetricLog(msg))
}

func (l LunarTelemetric) Close() {
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
		URL:             telemetricServerHealthcheckURL,
		BodyPredicate:   func(_ []byte) bool { return true },
		StatusPredicate: func(code int) bool { return code == 200 },
		HTTPClient:      http.DefaultClient,
	}
	return client.WaitForHealthcheck(clock, &retryConfig, &healthcheckConfig)
}

func isTelemetriesEnabled() bool {
	if getTelemetricEnableStatus() != telemetricEnable {
		log.Info().Msg("Lunar Telemetric has been disabled.")
		return false
	}
	return true
}

func getTelemetricsLogger(defaultLogger *zerolog.Logger,
	appName string,
	clock clock.Clock,
) *LunarTelemetric {
	udpConn, err := net.Dial("udp", telemetricDestination)
	if err != nil {
		log.Trace().Err(err).Msg("Failed to create UDP connection.")
		return nil
	}

	_ = waitForHealthcheck(clock)

	telemetricLogLevel := getTelemetricsLogLevel()
	telemetricLogger := zerolog.New(udpConn).
		Level(telemetricLogLevel).With().Timestamp().Str("app_name", appName).Logger()

	telemetrics := LunarTelemetric{
		defaultLogger,
		&telemetricLogger,
		&udpConn,
	}
	return &telemetrics
}

func prepareTelemetricLog(logMessage string) string {
	// TODO: Here we should add logic to remove PII׳s
	// and add additional Telemetric information.
	return logMessage
}
