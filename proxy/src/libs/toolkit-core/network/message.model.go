package network

type Message struct {
	Event        string `json:"event"`
	ProxyVersion string `json:"proxy_version"`
	Data         string `json:"data"`
}
