package logging

import (
	"fmt"
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
	telemetryServerHost           = getTelemetryServerHost()
	telemetryServerHealthcheckURL = fmt.Sprintf("http://%v:2020", telemetryServerHost)
	telemetryDestination          = telemetryServerHost + ":" + telemetryDestinationPort
)

type LunarTelemetryWriter struct {
	telemetryLogger *zerolog.Logger
	udpConnection   *net.Conn
}

func (l LunarTelemetryWriter) Write(p []byte) (n int, err error) {
	n, err = l.telemetryLogger.Write(prepareTelemetryLog(p))
	return n, err
}

func (l LunarTelemetryWriter) WriteLevel(
	level zerolog.Level,
	payload []byte,
) (n int, err error) {
	if level < l.telemetryLogger.GetLevel() {
		return len(payload), err
	}
	n, err = l.Write(payload)
	return n, err
}

func (l LunarTelemetryWriter) Close() {
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

func getTelemetryWriter(
	appName string,
	clock clock.Clock,
) *LunarTelemetryWriter {
	udpConn, err := net.Dial("udp", telemetryDestination)
	if err != nil {
		log.Trace().Err(err).Msg("Failed to create UDP connection.")
		return nil
	}

	_ = waitForHealthcheck(clock)

	telemetryLogLevel := getTelemetryLogLevel()
	telemetryLogger := zerolog.New(udpConn).
		Level(telemetryLogLevel).With().Timestamp().Str("app_name", appName).Logger()

	telemetry := LunarTelemetryWriter{
		&telemetryLogger,
		&udpConn,
	}
	return &telemetry
}

func prepareTelemetryLog(logMessage []byte) []byte {
	// TODO: Here we should add logic to remove PII׳s
	// and add additional Telemetry information.
	return logMessage
}
