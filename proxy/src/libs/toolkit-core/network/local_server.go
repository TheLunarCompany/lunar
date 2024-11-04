package network

import (
	"encoding/json"
	"net"
	"os"
	"sync"

	"github.com/rs/zerolog/log"
)

type LocalServer struct {
	listener   net.Listener
	socketPath string
	handlers   map[WebSocketMessageEvent]func([]byte)
	clients    map[net.Conn]struct{}
	mu         sync.Mutex
}

func NewLocalServer(socketPath string) *LocalServer {
	return &LocalServer{
		socketPath: socketPath,
		handlers:   make(map[WebSocketMessageEvent]func([]byte)),
		clients:    make(map[net.Conn]struct{}),
	}
}

func (localServer *LocalServer) RegisterHandler(key WebSocketMessageEvent, handler func([]byte)) {
	localServer.handlers[key] = handler
}

func (localServer *LocalServer) Stop() {
	if localServer.listener == nil {
		return
	}

	for conn := range localServer.clients {
		_ = conn.Close()
	}

	_ = localServer.listener.Close()
	localServer.listener = nil
}

func (localServer *LocalServer) Start() {
	if localServer.listener != nil {
		return
	}

	if _, err := os.Stat(localServer.socketPath); err == nil {
		os.Remove(localServer.socketPath)
	}

	listener, err := net.Listen("unix", localServer.socketPath)
	if err != nil {
		log.Error().Err(err).Msg("LocalServer::Failed to start listener")
		return
	}

	localServer.listener = listener
	go localServer.start()
}

func (localServer *LocalServer) Broadcast(msg LocalMessage) error {
	localServer.mu.Lock()
	defer localServer.mu.Unlock()

	msgJSON, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	for conn := range localServer.clients {
		_, _ = conn.Write(msgJSON)
	}
	return nil
}

func (localServer *LocalServer) start() {
	for {
		conn, err := localServer.listener.Accept()
		if err != nil {
			return
		}
		localServer.mu.Lock()
		localServer.clients[conn] = struct{}{}
		localServer.mu.Unlock()

		go localServer.handleConnection(conn)
	}
}

func (localServer *LocalServer) handleConnection(conn net.Conn) {
	for {

		buf := make([]byte, 1024)
		bytesLength, err := conn.Read(buf)
		if err != nil {
			localServer.mu.Lock()
			_ = conn.Close()
			delete(localServer.clients, conn)
			localServer.mu.Unlock()
			return
		}

		var msg LocalMessage
		if err := json.Unmarshal(buf[:bytesLength], &msg); err != nil {
			log.Trace().Msgf("LocalServer::Failed to parse JSON message: %v", err)
			continue
		}

		localServer.mu.Lock()
		handler, exists := localServer.handlers[msg.Key]
		localServer.mu.Unlock()

		if exists {
			handler(msg.Value)
		} else {
			log.Trace().Msgf("LocalServer::No handler registered for key: %s\n", msg.Key)
		}
	}
}
