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
	telemetryDestinationPort        = getTelemetryServerPort()
	criticalMessagesDestinationPort = getCriticalMessagesServerPort()
	telemetryServerHost             = getTelemetryServerHost()
	telemetryServerHealthcheckURL   = fmt.Sprintf("http://%v:2020", telemetryServerHost)
	telemetryDestination            = telemetryServerHost + ":" + telemetryDestinationPort
	criticalMessagesDestination     = telemetryServerHost + ":" + criticalMessagesDestinationPort
)

type WriterType string

const (
	TelemetryWriterType        WriterType = "telemetry"
	CriticalMessagesWriterType WriterType = "critical_messages"
)

type LunarLogger struct {
	Logger        *zerolog.Logger
	writerType    WriterType
	udpConnection *net.Conn
}

func (l LunarLogger) Write(p []byte) (n int, err error) {
	n, err = l.Logger.Write(prepareTelemetryLog(p))
	return n, err
}

func (l LunarLogger) WriteLevel(
	level zerolog.Level,
	payload []byte,
) (n int, err error) {
	if level < l.Logger.GetLevel() {
		return len(payload), err
	}
	n, err = l.Write(payload)
	return n, err
}

func (l LunarLogger) Close() {
	log.Info().Msgf("Closing %s Lunar Logger UDP connection", l.writerType)
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

func getLunarLogger(
	appName string,
	writerType WriterType,
	clock clock.Clock,
) *LunarLogger {
	var writerDestination string
	var writerLogLevel zerolog.Level

	if writerType == CriticalMessagesWriterType {
		writerDestination = criticalMessagesDestination
		writerLogLevel = getCriticalMessagesLogLevel()
	} else {
		writerDestination = telemetryDestination
		writerLogLevel = getTelemetryLogLevel()
	}

	udpConn, err := net.Dial("udp", writerDestination)
	if err != nil {
		log.Trace().Err(err).Msg("Failed to create UDP connection.")
		return nil
	}

	_ = waitForHealthcheck(clock)

	telemetryLogger := zerolog.New(udpConn).
		Level(writerLogLevel).With().Timestamp().Str("app_name", appName).Logger()

	logger := LunarLogger{
		&telemetryLogger,
		writerType,
		&udpConn,
	}
	return &logger
}

func prepareTelemetryLog(logMessage []byte) []byte {
	// TODO: Here we should add logic to remove PII׳s
	// and add additional Telemetry information.
	return logMessage
}
