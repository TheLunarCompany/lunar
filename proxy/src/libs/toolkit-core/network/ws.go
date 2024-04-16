package network

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

const waitUntilRetry = 2 * time.Second

type WSClient struct {
	url              string
	handshakeHeaders http.Header
	conn             *websocket.Conn
	sendChan         chan []byte
}

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

func (client *WSClient) Connect() error {
	dialer := websocket.Dialer{ //nolint:exhaustruct
		Subprotocols: []string{"token"},
	}

	conn, _, err := dialer.Dial(client.url, client.handshakeHeaders)
	if err != nil {
		return err
	}

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

func (client *WSClient) Send(data *Message) error {
	msg, err := json.Marshal(data)
	if err != nil {
		return err
	}
	client.sendChan <- msg
	return nil
}

func (client *WSClient) readLoop() {
	for {
		_, _, err := client.conn.ReadMessage()
		if err != nil {
			log.Debug().Err(err).Msg("WebSocket: read error")
			log.Trace().Msg("WebSocket: Attempting to reconnect...")
			time.Sleep(waitUntilRetry)
			err := client.Connect()
			if err != nil {
				log.Error().Err(err).Msg("Reconnect failed")
			} else {
				log.Debug().Msg("Reconnect successful")
			}
		}
	}
}

func (client *WSClient) writeLoop() {
	for msg := range client.sendChan {
		err := client.conn.WriteMessage(websocket.TextMessage, msg)
		if err != nil {
			log.Debug().Err(err).Msg("WebSocket: write error")
			log.Trace().Msg("WebSocket: Attempting to reconnect...")
			time.Sleep(waitUntilRetry)
			err := client.Connect()
			if err != nil {
				log.Error().Err(err).Msg("WebSocket: write error")
			} else {
				log.Debug().Msg("Reconnect successful")
			}
		}
	}
}
