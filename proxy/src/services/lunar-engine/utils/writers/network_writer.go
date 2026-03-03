package writers

import (
	"fmt"
	"net"
	"sync"
)

type NetworkWriter struct {
	network string
	address string

	mutex      sync.RWMutex
	connection serverConnection
}

func (writer *NetworkWriter) connect() (err error) {
	writer.mutex.Lock()
	defer writer.mutex.Unlock()

	if writer.connection != nil {
		return nil
	}

	connection, err := net.Dial(writer.network, writer.address)
	if err != nil {
		return fmt.Errorf("failed to setup %s connection to %s:%s, error: %s",
			writer.network, writer.network, writer.address, err)
	}
	writer.connection = &netConn{connection: connection}

	return err
}

func (writer *NetworkWriter) Write(message []byte) (int, error) {
	writer.mutex.RLock()
	isDisconnected := writer.connection == nil
	writer.mutex.RUnlock()

	if isDisconnected {
		if err := writer.connect(); err != nil {
			return 0, err
		}
	}

	return writer.write(message)
}

func (writer *NetworkWriter) Close() error {
	writer.mutex.Lock()
	defer writer.mutex.Unlock()

	if writer.connection != nil {
		err := writer.connection.close()
		writer.connection = nil
		return err
	}
	return nil
}

func (writer *NetworkWriter) write(message []byte) (int, error) {
	err := writer.connection.writeBytes(message)
	if err != nil {
		_ = writer.Close() // Closing the connection for reconnection on the next write.
		return 0, err
	}
	return len(message), nil
}
