package haproxy

import (
	"bufio"
	"fmt"
	"net"
	"strconv"
	"strings"
	"sync"
)

type Stats struct {
	socketPath string
	mu         sync.Mutex
}

func NewHAProxyStatsClient(socketPath string) (*Stats, error) {
	if socketPath == "" {
		return nil, fmt.Errorf("socket path cannot be empty")
	}

	return &Stats{
		socketPath: socketPath,
	}, nil
}

func (c *Stats) QueryRemainingConnections() (remaining int, err error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	conn, err := net.Dial("unix", c.socketPath)
	if err != nil {
		return 0, fmt.Errorf("failed to connect to HAProxy socket: %w", err)
	}

	defer conn.Close()

	_, err = conn.Write([]byte("show info\n"))
	if err != nil {
		return 0, fmt.Errorf("failed to write to HAProxy socket: %w", err)
	}

	var currConns, maxConns int
	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "CurrConns:") {
			currConns, _ = strconv.Atoi(strings.TrimSpace(strings.Split(line, ":")[1]))
		} else if strings.HasPrefix(line, "Maxconn:") {
			maxConns, _ = strconv.Atoi(strings.TrimSpace(strings.Split(line, ":")[1]))
		}
		if line == "" {
			break
		}
	}

	if err := scanner.Err(); err != nil {
		return 0, fmt.Errorf("scanner error: %w", err)
	}

	return maxConns - currConns, nil
}
