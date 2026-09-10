package network

import (
	"context"
	"net"

	"github.com/negasus/haproxy-spoe-go/frame"
	"github.com/rs/zerolog/log"
)

// The index of the message type in the message buffer.
// (https://github.com/negasus/haproxy-spoe-go/blob/master/frame/read.go#L24)
const MessageTypeIndex int = 4

type SPOEConn struct {
	net.Conn
}

func (tc *SPOEConn) isAgentDisconnectType(msgBuffer []byte, messageLength int) bool {
	if messageLength < 5 {
		log.Error().Msgf("WriteType::Invalid message length")
		return false
	}
	msgType := msgBuffer[MessageTypeIndex]
	return msgType == byte(frame.TypeAgentDisconnect)
}

func (tc *SPOEConn) Read(msgBuffer []byte) (int, error) {
	return tc.Conn.Read(msgBuffer)
}

func (tc *SPOEConn) Write(msgBuffer []byte) (int, error) {
	bufferLength := len(msgBuffer)
	if tc.isAgentDisconnectType(msgBuffer, bufferLength) {
		// Avoid writing to the connection if the agent is disconnecting.
		// This is to prevent the agent from sending messages to closed connections.
		// We should remove this once we update HAProxy to 3.1.0.
		return len(msgBuffer), nil
	}
	return tc.Conn.Write(msgBuffer)
}

type SPOEListener struct {
	net.Listener
}

func (tl *SPOEListener) Accept() (net.Conn, error) {
	conn, err := tl.Listener.Accept()
	if err != nil {
		return nil, err
	}

	return &SPOEConn{
		Conn: conn,
	}, nil
}

func NewSPOEListener(
	network, address string,
) (net.Listener, error) {
	lc := net.ListenConfig{}
	listener, err := lc.Listen(context.Background(), network, address)
	if err != nil {
		return nil, err
	}
	return &SPOEListener{
		Listener: listener,
	}, nil
}

func CloseListener(l net.Listener) {
	err := l.Close()
	if err != nil {
		log.Error().Err(err).Msg("Failed to close listener")
	}
}
