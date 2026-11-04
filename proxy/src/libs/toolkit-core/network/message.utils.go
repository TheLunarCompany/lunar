package network

func (c ConfigurationPayload) IsDataSet() bool {
	if c.FileName != "" &&
		c.Type != "" &&
		len(c.Content) > 0 {
		return true
	}
	return false
}

func (ym *ConfigurationMessage) GetEvent() WebSocketMessageEvent {
	return ym.Event
}

func (dm *DiscoveryMessage) GetEvent() WebSocketMessageEvent {
	return dm.Event
}

func (mm *MetricsMessage) GetEvent() WebSocketMessageEvent {
	return mm.Event
}
