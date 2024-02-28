package network

import "lunar/shared-model/discovery"

type Message struct {
	Event string           `json:"event"`
	Data  discovery.Output `json:"data"`
}
