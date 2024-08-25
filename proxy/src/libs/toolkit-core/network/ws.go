package network

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

const (
	waitUntilRetry         = 2 * time.Second
	connectionPingInterval = 1 * time.Second
	connectionEstablished  = "ready"
)

type (
	OnMessageFunc    func([]byte)
	OnDisconnectFunc func()

	WSClient struct {
		url                  string
		handshakeHeaders     http.Header
		conn                 *websocket.Conn
		sendChan             chan []byte
		onMessageCallback    OnMessageFunc
		onDisconnectCallback OnDisconnectFunc
		connReadySignal      chan struct{}
		connReadyMutex       sync.Mutex
	}
)

func NewWSClient(url string, handshakeHeaders http.Header) *WSClient {
	return &WSClient{ //nolint:exhaustruct
		url:              url,
		handshakeHeaders: handshakeHeaders,
		sendChan:         make(chan []byte),
	}
}

func (client *WSClient) ConnectAndStart() error {
	err := client.Connect()
	if err != nil {
		return err
	}

	client.Start()

	return nil
}

func (client *WSClient) OnMessage(callback OnMessageFunc) {
	client.onMessageCallback = callback
}

func (client *WSClient) OnDisconnect(callback OnDisconnectFunc) {
	client.onDisconnectCallback = callback
}

func (client *WSClient) Connect() error {
	client.setConnectionNotReady()
	dialer := websocket.Dialer{ //nolint:exhaustruct
		Subprotocols: []string{"token"},
	}

	conn, _, err := dialer.Dial(client.url, client.handshakeHeaders)
	if err != nil {
		return err
	}

	conn.SetPongHandler(func(string) error {
		log.Debug().Msg("WSClient::SetPongHandlerReceived pong from server")
		client.setConnectionReady()
		return nil
	})

	go client.startPing()
	client.conn = conn
	return nil
}

func (client *WSClient) Start() {
	go client.readLoop()
	go client.writeLoop()
}

func (client *WSClient) Close() error {
	close(client.sendChan)
	return client.conn.Close()
}

func (client *WSClient) Send(msg MessageI) error {
	msgBytes, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	client.sendChan <- msgBytes
	return nil
}

func (client *WSClient) readLoop() {
	for {
		_, msg, err := client.conn.ReadMessage()
		if err != nil {
			log.Debug().Err(err).Msg("WSClient: read error")
			client.onConnectionError()

		} else if client.onMessageCallback != nil {
			client.onMessageCallback(msg)
		}
	}
}

func (client *WSClient) writeLoop() {
	for msg := range client.sendChan {
		// Wait until the connection is ready
		if !client.IsConnectionReady() {
			<-client.connReadySignal
		}
		log.Debug().Msg("WSClient::writeLoop Connection is ready")
		log.Trace().Msgf("Sending message: %s", string(msg))
		if err := client.conn.WriteMessage(websocket.BinaryMessage, msg); err != nil {
			log.Debug().Err(err).Msg("WSClient: write error")
			client.onConnectionError()
		}
	}
}

func (client *WSClient) onConnectionError() {
	log.Trace().Msg("WSClient: Attempting to reconnect...")
	time.Sleep(waitUntilRetry)
	connErr := client.Connect()
	if connErr != nil {
		log.Error().Err(connErr).Msg("WSClient: write error")
	} else {
		log.Debug().Msg("Reconnect successful")
	}
}

func (client *WSClient) setConnectionNotReady() {
	log.Debug().Msg("WSClient::setConnectionNotReady")
	client.connReadyMutex.Lock()
	defer client.connReadyMutex.Unlock()
	if client.connReadySignal != nil {
		return
	}
	client.connReadySignal = make(chan struct{})
}

func (client *WSClient) setConnectionReady() {
	log.Debug().Msg("WSClient::setConnectionReady")
	client.connReadyMutex.Lock()
	defer client.connReadyMutex.Unlock()

	if client.connReadySignal == nil {
		return
	}

	close(client.connReadySignal)
	client.connReadySignal = nil
}

func (client *WSClient) IsConnectionReady() bool {
	client.connReadyMutex.Lock()
	defer client.connReadyMutex.Unlock()

	return client.connReadySignal == nil
}

func (client *WSClient) startPing() {
	// Note: This function will ping the server every second to keep the connection alive.
	// Execute this function in a separate goroutine to avoid blocking the main thread.
	for !client.IsConnectionReady() {
		_ = client.conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(5*time.Second))
		time.Sleep(connectionPingInterval) // Ping every second.
	}
}
