package writers

import (
	"fmt"
	"lunar/toolkit-core/client"
	"lunar/toolkit-core/clock"
	"net"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

type UDPWriter struct {
	network string
	address string

	mutex      sync.Mutex
	connection serverConnection
}

type serverConnection interface {
	writeBytes(message []byte) error
	close() error
}

type netConn struct {
	connection net.Conn
}

func Dial(
	network string,
	address string,
	clock clock.Clock,
) (*UDPWriter, error) {
	writer := &UDPWriter{ //nolint:exhaustruct
		network: network,
		address: address,
	}

	writer.mutex.Lock()
	defer writer.mutex.Unlock()

	retryConfig := client.RetryConfig{
		Attempts:           3,
		SleepMillis:        1000,
		WithInitialSleep:   false,
		InitialSleepMillis: 0,
		FailedAttemptLog:   "🔁 Failed  attempt to connect to UDP server",
		FailureLog:         "🔁 Failed to connect to UDP server",
	}
	log.Debug().Msg("🧪 Trying to connect to UDP server...")
	_, err := client.WithRetry(
		clock,
		&retryConfig,
		func() (interface{}, error) {
			return struct{}{}, writer.connect()
		},
	)
	if err != nil {
		return nil, err
	}
	log.Debug().Msg("✅ Successfully connected to UDP server")
	return writer, nil
}

func (writer *UDPWriter) connect() (err error) {
	if writer.connection != nil {
		writer.connection.close()
		writer.connection = nil
	}

	var connection net.Conn
	connection, err = net.Dial(writer.network, writer.address)
	if err != nil {
		return fmt.Errorf("Failed to setup UDP connection to %s:%s, error: %s",
			writer.network, writer.address, err)
	}
	writer.connection = &netConn{connection: connection}

	return err
}

func (writer *UDPWriter) Write(b []byte) (int, error) {
	return writer.writeAndRetry(b)
}

func (writer *UDPWriter) Close() error {
	writer.mutex.Lock()
	defer writer.mutex.Unlock()

	if writer.connection != nil {
		err := writer.connection.close()
		writer.connection = nil
		return err
	}
	return nil
}

func (writer *UDPWriter) writeAndRetry(message []byte) (int, error) {
	writer.mutex.Lock()
	defer writer.mutex.Unlock()

	// if no connection
	if writer.connection == nil {
		if err := writer.connect(); err != nil {
			return 0, err
		}
	}

	return writer.write(message)
}

func (writer *UDPWriter) write(message []byte) (int, error) {
	err := writer.connection.writeBytes(message)
	if err != nil {
		return 0, err
	}
	return len(message), nil
}

func (networkConnection *netConn) writeBytes(message []byte) error {
	message = addTimestampPrefix(message)
	message = ensureEndsWithNewline(message)
	_, err := networkConnection.connection.Write(message)
	return err
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

func (networkConnection *netConn) close() error {
	return networkConnection.connection.Close()
}

func ensureEndsWithNewline(message []byte) []byte {
	var endOfLine byte = '\n'
	message = append(message, endOfLine)
	return message
}
