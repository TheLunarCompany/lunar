package config

func (endpoint *EndpointConfig) Match(method string, url string) bool {
	return endpoint != nil && endpoint.Method == method && endpoint.URL == url
}
