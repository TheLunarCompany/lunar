package shareddiscovery

type KnownEndpoints struct {
	Endpoints []Endpoint `yaml:"endpoints"`
}

type Endpoint struct {
	Method string `json:"method" yaml:"method"`
	URL    string `json:"url"    yaml:"url"`
}
