package shareddiscovery

type KnownEndpoints struct {
	Endpoints []Endpoint `yaml:"endpoints"`
}

type Endpoint struct {
	Method string `json:"method" yaml:"method"`
	URL    string `json:"url"    yaml:"url"`
}

type Count int

type EndpointAgg struct {
	MinTime int64
	MaxTime int64

	Count           Count
	StatusCodes     map[int]Count
	AverageDuration float32
}
