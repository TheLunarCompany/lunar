package writers

import (
	"lunar/toolkit-core/client"
	"lunar/toolkit-core/clock"
	"net"
	"time"

	"github.com/rs/zerolog/log"
)

type Writer interface {
	Write(b []byte) (int, error)
	Close() error
}

type serverConnection interface {
	writeBytes(message []byte) error
	close() error
}

type netConn struct {
	connection net.Conn
}

// Dial function is not thread safe.
func Dial(
	network string,
	address string,
	clock clock.Clock,
) Writer {
	writer := &NetworkWriter{ //nolint:exhaustruct
		network: network,
		address: address,
	}

	retryConfig := client.RetryConfig{
		Attempts:           3,
		SleepMillis:        1000,
		WithInitialSleep:   false,
		InitialSleepMillis: 0,
		FailedAttemptLog:   "🔁 Failed  attempt to connect to export server",
		FailureLog:         "🔁 Failed to connect to export server",
	}

	log.Debug().Msgf("🧪 Trying to connect to %s server...", network)
	_, err := client.WithRetry(
		clock,
		&retryConfig,
		func() (interface{}, error) {
			return struct{}{}, writer.connect()
		},
	)
	if err != nil {
		log.Error().Err(err).Msgf("Failed to open %s connection, "+
			"exporting is disabled", network)
		return NewNullWriter()
	}
	log.Debug().Msgf("✅ Successfully connected to %s server", network)
	return writer
}

func addTimestampPrefix(message []byte) []byte {
	const space byte = ' '
	timestamp := time.Now().Format(time.RFC3339Nano)

	result := make(
		[]byte,
		0,
		len(timestamp)+len(message)+1, // +1 for space after timestamp
	)
	result = append(result, timestamp...)
	result = append(result, space)
	result = append(result, message...)

	return result
}

func (networkConnection *netConn) writeBytes(message []byte) error {
	message = addTimestampPrefix(message)
	message = ensureEndsWithNewline(message)
	_, err := networkConnection.connection.Write(message)
	return err
}

func (networkConnection *netConn) close() error {
	return networkConnection.connection.Close()
}

func ensureEndsWithNewline(message []byte) []byte {
	var endOfLine byte = '\n'
	message = append(message, endOfLine)
	return message
}
