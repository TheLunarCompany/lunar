package network

import (
	"context"
	"net"
	"time"

	"github.com/rs/zerolog/log"
)

type TimeoutListener struct {
	net.Listener
	deadlineTimeout time.Duration
}

func (tl *TimeoutListener) Accept() (net.Conn, error) {
	conn, err := tl.Listener.Accept()
	if err != nil {
		return nil, err
	}
	if err = conn.SetDeadline(time.Now().Add(tl.deadlineTimeout)); err != nil {
		return nil, err
	}

	return conn, nil
}

func NewTimeoutListener(
	network, address string,
	timeout time.Duration,
) (net.Listener, error) {
	lc := net.ListenConfig{}
	listener, err := lc.Listen(context.Background(), network, address)
	if err != nil {
		return nil, err
	}
	return &TimeoutListener{
		Listener:        listener,
		deadlineTimeout: timeout,
	}, nil
}

func CloseListener(l net.Listener) {
	err := l.Close()
	if err != nil {
		log.Error().Err(err).Msg("Failed to close listener")
	}
}
