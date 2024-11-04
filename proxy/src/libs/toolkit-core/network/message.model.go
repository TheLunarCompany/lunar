package network

import (
	sharedDiscovery "lunar/shared-model/discovery"
)

type MessageI interface {
	GetEvent() WebSocketMessageEvent
}

type LocalMessage struct {
	Key   WebSocketMessageEvent `json:"key"`
	Value []byte                `json:"value"`
}

type DiscoveryMessage struct {
	Event WebSocketMessageEvent  `json:"event"`
	Data  sharedDiscovery.Output `json:"data"`
}

type ConfigurationMessage struct {
	Event WebSocketMessageEvent `json:"event"`
	Data  ConfigurationData     `json:"data"`
}

type ConfigurationData struct {
	Data []ConfigurationPayload `json:"data"`
}

type ConfigurationPayload struct {
	Type     string `json:"type"`
	FileName string `json:"file_name"`
	Content  []byte `json:"content"`
}

type (
	WebSocketConnectionEvent string
	WebSocketMessageEvent    string
)

const (
	WebSocketEventDiscovery         WebSocketMessageEvent = "discovery-event"
	WebSocketEventMetrics           WebSocketMessageEvent = "metrics-event"
	WebSocketEventConfigurationLoad WebSocketMessageEvent = "configuration-load-event"
)
