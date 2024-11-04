package network

import (
	"encoding/json"
	"io"
	"net"
	"sync"

	"github.com/rs/zerolog/log"
)

type localConnection struct {
	conn        net.Conn
	readySignal chan struct{}
	readyMutex  sync.Mutex
}

func newLocalConnection(socketPath string) (*localConnection, error) {
	conn, err := net.Dial("unix", socketPath)
	if err != nil {
		return nil, err
	}

	return &localConnection{
		conn:        conn,
		readySignal: make(chan struct{}),
	}, nil
}

func (localConn *localConnection) setConnectionReady() {
	localConn.readyMutex.Lock()
	defer localConn.readyMutex.Unlock()

	if localConn.readySignal == nil {
		return
	}

	close(localConn.readySignal)
	localConn.readySignal = nil
}

func (localConn *localConnection) close() {
	localConn.readyMutex.Lock()
	defer localConn.readyMutex.Unlock()
	if localConn.readySignal != nil {
		return
	}

	localConn.readySignal = make(chan struct{})
	_ = localConn.conn.Close()
}

func (localConn *localConnection) isConnectionReady() bool {
	localConn.readyMutex.Lock()
	defer localConn.readyMutex.Unlock()
	return localConn.readySignal == nil
}

type LocalClient struct {
	socketPath string
	conn       *localConnection
	mu         sync.Mutex
	done       chan struct{}
	handlers   map[WebSocketMessageEvent]func([]byte)
}

func NewLocalClient(socketPath string) *LocalClient {
	client := &LocalClient{
		socketPath: socketPath,
		handlers:   make(map[WebSocketMessageEvent]func([]byte)),
		done:       make(chan struct{}),
	}
	client.makeConnection()
	return client
}

func (localClient *LocalClient) makeConnection() {
	if err := localClient.connect(); err != nil {
		go localClient.tryConnectAsync()
	}
}

func (localClient *LocalClient) RegisterHandler(key WebSocketMessageEvent, handler func([]byte)) {
	localClient.mu.Lock()
	defer localClient.mu.Unlock()
	localClient.handlers[key] = handler
}

func (localClient *LocalClient) tryConnectAsync() {
	go func() {
		for {
			select {
			case <-localClient.done:
				return
			default:
				err := localClient.connect()
				if err == nil {
					return
				}
			}
		}
	}()
}

func (localClient *LocalClient) listenForServerMessages() {
	for {
		if localClient.conn == nil {
			return
		}
		if !localClient.conn.isConnectionReady() {
			<-localClient.conn.readySignal
		}

		select {
		case <-localClient.done:
			return
		default:
			buf := make([]byte, 1024)
			bytesLength, err := localClient.conn.conn.Read(buf)
			if err != nil {
				if err == io.EOF {
					log.Trace().Err(err).Msg("LocalClient::Connection closed by server")
					localClient.makeConnection()
					return
				}
				continue
			}

			var msg LocalMessage

			if err := json.Unmarshal(buf[:bytesLength], &msg); err != nil {
				log.Trace().Msgf("LocalClient::Failed to parse JSON message: %v", err)
				continue
			}

			localClient.mu.Lock()
			handler, exists := localClient.handlers[msg.Key]
			localClient.mu.Unlock()
			if exists {
				log.Trace().Msgf("LocalClient::Received message with key: %s, value: %+v\n", msg.Key, msg.Value)
				handler(msg.Value)
			} else {
				log.Trace().Msgf("LocalClient::No handler registered for key: %s\n", msg.Key)
			}
		}
	}
}

func (localClient *LocalClient) SendMessage(msg LocalMessage) error {
	msgJSON, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	_, err = localClient.conn.conn.Write(msgJSON)
	if err != nil {
		return err
	}
	return nil
}

func (localClient *LocalClient) Close() {
	close(localClient.done)
	localClient.conn.close()
}

func (localClient *LocalClient) connect() error {
	if localClient.conn != nil {
		localClient.conn.close()
		localClient.conn = nil
	}
	localClient.mu.Lock()
	defer localClient.mu.Unlock()
	localClient.done = make(chan struct{})
	conn, err := newLocalConnection(localClient.socketPath)
	if err != nil {
		return err
	}

	conn.setConnectionReady()
	localClient.conn = conn
	go localClient.listenForServerMessages()
	log.Trace().Msg("LocalClient::Connected to local aggregation server")
	return nil
}
