package network

import (
	sharedDiscovery "lunar/shared-model/discovery"
)

type MessageI interface {
	GetEvent() WebSocketMessageEvent
}

type DiscoveryMessage struct {
	Event WebSocketMessageEvent  `json:"event"`
	Data  sharedDiscovery.Output `json:"data"`
}

type ConfigurationMessage struct {
	Event WebSocketMessageEvent `json:"event"`
	Data  ConfigurationData     `json:"data"`
}

type MetricsMessage struct {
	Event WebSocketMessageEvent `json:"event"`
	Data  string                `json:"data"`
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
	WebSocketEventConfigurationLoad WebSocketMessageEvent = "configuration-load-event"
	WebSocketEventMetrics           WebSocketMessageEvent = "instance-level-metrics"
)
