package network

import (
	"crypto/tls"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

const (
	waitUntilRetry         = 2 * time.Second
	connectionPingInterval = 1 * time.Second
	connectionReady        = "ready"
	pingTimeout            = 15 * time.Second
	maxBackoff             = 2 * time.Minute
	maxMissedPongs         = 5
)

type (
	OnMessageFunc    func([]byte)
	OnDisconnectFunc func()

	WSClient struct {
		isReconnecting       atomic.Bool
		url                  url.URL
		handshakeHeaders     http.Header
		conn                 *websocket.Conn
		writeMutex           sync.Mutex
		sendChan             chan []byte
		onMessageCallback    OnMessageFunc
		onDisconnectCallback OnDisconnectFunc
		// connReadySignal is a signal to indicate that the connection is ready.
		// When connection is ready, becomes nil.
		connReadySignal  chan struct{}
		connReadyMutex   sync.RWMutex
		missedPongs      int
		missedPongsMutex sync.Mutex
		logger           zerolog.Logger
	}
)

func NewWSClient(url url.URL, handshakeHeaders http.Header) *WSClient {
	return &WSClient{ //nolint:exhaustruct
		url:              url,
		handshakeHeaders: handshakeHeaders,
		sendChan:         make(chan []byte),
		connReadySignal:  make(chan struct{}),
		logger:           log.Logger.With().Str("component", "WSClient").Logger(),
	}
}

func (client *WSClient) ConnectAndStart() error {
	err := client.connect()
	if err != nil {
		return err
	}

	client.start()

	// Wait for connection to be ready (authorized)
	select {
	case <-client.connReadySignal:
		return nil
	case <-time.After(pingTimeout):
		return errors.New("connected but didn't receive `ready` message")
	}
}

func (client *WSClient) OnMessage(callback OnMessageFunc) {
	client.onMessageCallback = callback
}

func (client *WSClient) OnDisconnect(callback OnDisconnectFunc) {
	client.onDisconnectCallback = callback
}

func (client *WSClient) connect() error {
	client.setConnectionNotReady()
	dialer := websocket.Dialer{ //nolint:exhaustruct
		Subprotocols: []string{"token"},
	}

	tlsConfig := &tls.Config{
		InsecureSkipVerify: false,
	}

	if client.url.Scheme == "wss" {
		dialer.TLSClientConfig = tlsConfig
	}

	conn, _, err := dialer.Dial(client.url.String(), client.handshakeHeaders)
	if err != nil {
		return err
	}
	client.writeMutex.Lock()
	client.sendChan = make(chan []byte)
	client.writeMutex.Unlock()

	client.conn = conn

	go client.startPing()
	return nil
}

func (client *WSClient) Close() error {
	client.closeSendChan()
	if client.conn != nil {
		return client.conn.Close()
	}
	return nil
}

func (client *WSClient) Send(msg MessageI) error {
	if !client.IsConnectionReadyAndAuthorized() {
		client.logger.Debug().Msg("connection not ready, discarding message")
		return errors.New("connection not ready")
	}
	msgBytes, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	select {
	case client.sendChan <- msgBytes:
	default:
		client.logger.Debug().Msg("failed to send message, channel may be closed")
		return errors.New("send channel is closed")
	}
	return nil
}

func (client *WSClient) handleConnectionReady(payload []byte) bool {
	if string(payload) == connectionReady {
		client.logger.Trace().Msgf("handling ready (ping) message")
		client.resetMissedPongs()
		client.setConnectionReady()
		return true
	}
	return false
}

func (client *WSClient) start() {
	go client.readLoop()
	go client.writeLoop()
}

func (client *WSClient) readLoop() {
	for {
		_, msg, err := client.conn.ReadMessage()
		if err != nil {
			client.logger.Debug().Err(err).Msg("read error")
			client.onConnectionError()
			return
		}
		if client.handleConnectionReady(msg) {
			continue
		}
		if client.onMessageCallback != nil {
			client.onMessageCallback(msg)
		}
	}
}

func (client *WSClient) writeLoop() {
	for msg := range client.sendChan {
		// Wait until the connection is ready
		if !client.IsConnectionReadyAndAuthorized() {
			<-client.connReadySignal
			client.logger.Debug().Str("func", "writeLoop").Msg("Connection is ready")
		}
		client.logger.Trace().Msgf("Sending message: %s", string(msg))

		client.writeMutex.Lock()
		err := client.conn.WriteMessage(websocket.BinaryMessage, msg)
		client.writeMutex.Unlock()

		if err != nil {
			client.logger.Debug().Err(err).Msg("write error")
			client.onConnectionError()
			return
		}
	}
}

func (client *WSClient) onConnectionError() {
	client.logger.Trace().Msg("connection error, attempting to reconnect...")
	client.setConnectionNotReady()

	client.closeSendChan()

	if client.conn != nil {
		client.conn.Close()
	}
	go client.reconnectWithBackoff()
}

func (client *WSClient) closeSendChan() {
	client.writeMutex.Lock()
	defer client.writeMutex.Unlock()

	select {
	case <-client.sendChan: // If already closed, do nothing
	default:
		close(client.sendChan) // Close only if not already closed
	}
}

func (client *WSClient) reconnectWithBackoff() {
	if client.isReconnecting.Load() {
		client.logger.Trace().Msg("already in the process of reconnecting")
		return
	}

	client.isReconnecting.Store(true)
	defer client.isReconnecting.Store(false)

	backoff := waitUntilRetry
	for {
		<-time.After(backoff)
		if err := client.ConnectAndStart(); err != nil {
			backoff *= 2
			if backoff > maxBackoff {
				backoff = maxBackoff
			}
			client.logger.Debug().
				Err(err).
				Msgf("reconnection attempt failed, will wait %s before retrying", backoff)
		} else {
			client.logger.Debug().Msg("reconnection successful")
			return
		}
	}
}

func (client *WSClient) setConnectionNotReady() {
	client.logger.Debug().Msg("setting connection as not ready")
	client.connReadyMutex.Lock()
	defer client.connReadyMutex.Unlock()
	if client.connReadySignal != nil {
		return
	}
	client.connReadySignal = make(chan struct{})
}

func (client *WSClient) setConnectionReady() {
	client.connReadyMutex.Lock()
	defer client.connReadyMutex.Unlock()

	if client.connReadySignal == nil {
		return
	}

	client.logger.Debug().Str("func", "setConnectionReady").Msg("setting connection as ready")
	close(client.connReadySignal)
	client.connReadySignal = nil
}

func (client *WSClient) IsConnectionReadyAndAuthorized() bool {
	client.connReadyMutex.RLock()
	defer client.connReadyMutex.RUnlock()

	return client.connReadySignal == nil
}

// Meant to be run in the background
func (client *WSClient) startPing() {
	ticker := time.NewTicker(connectionPingInterval)
	defer ticker.Stop()

	client.resetMissedPongs()

	for range ticker.C {
		client.writeMutex.Lock()
		err := client.conn.WriteMessage(websocket.PingMessage, nil)
		client.writeMutex.Unlock()

		if err != nil {
			client.logger.Debug().Err(err).Msg("ping error")
			client.onConnectionError()
			return
		}

		missedPongs := client.incrMissedPongs()
		if missedPongs >= maxMissedPongs {
			client.logger.Debug().
				Int("missedPongs", missedPongs).
				Msg("missed too many PONGs, reconnecting...")
			client.onConnectionError()
			return
		}
	}
}

func (client *WSClient) resetMissedPongs() {
	client.missedPongsMutex.Lock()
	defer client.missedPongsMutex.Unlock()
	client.missedPongs = 0
}

func (client *WSClient) incrMissedPongs() int {
	client.missedPongsMutex.Lock()
	defer client.missedPongsMutex.Unlock()
	client.missedPongs++
	return client.missedPongs
}
