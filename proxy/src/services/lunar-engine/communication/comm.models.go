package communication

import "lunar/toolkit-core/network"

type EventType = string

type WebSocketMessage struct {
	Event network.WebSocketConnectionEvent `json:"event"`
	Data  interface{}                      `json:"data"`
}
