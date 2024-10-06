package network

func (ym *ConfigurationMessage) GetEvent() WebSocketMessageEvent {
	return ym.Event
}

func (dm *DiscoveryMessage) GetEvent() WebSocketMessageEvent {
	return dm.Event
}
