package streamconfig

type FlowRepresentation struct {
	Name       string               `yaml:"name"`
	Filters    Filter               `yaml:"filters"`
	Processors map[string]Processor `yaml:"processors"`
	Flow       Flow                 `yaml:"flow"`
}
type Flow struct {
	Request  []*FlowConnection `yaml:"request"`
	Response []*FlowConnection `yaml:"response"`
}

type FlowConnection struct {
	From *Connection `yaml:"from"`
	To   *Connection `yaml:"to"`
}

type Connection struct {
	Stream    *StreamRef    `yaml:"stream,omitempty"`
	Flow      *FlowRef      `yaml:"flow,omitempty"`
	Processor *ProcessorRef `yaml:"processor,omitempty"`
}

type FlowRef struct {
	Name string `yaml:"name"`
	At   string `yaml:"at"`
}
type StreamRef struct {
	Name string `yaml:"name"`
	At   string `yaml:"at"`
}
type ProcessorRef struct {
	Name string `yaml:"name"`
	On   string `yaml:"on,omitempty"`
}

type Filter struct {
	Name        string     `yaml:"name"`
	URL         string     `yaml:"url"`
	QueryParams []KeyValue `yaml:"query_params,omitempty"`
	Method      []string   `yaml:"method,omitempty"`
	Headers     []KeyValue `yaml:"headers,omitempty"`
	StatusCode  []int      `yaml:"status_code,omitempty"`
}

type Processor struct {
	Processor  string                `yaml:"processor"`
	Parameters map[string]ParamValue `yaml:"parameters,omitempty"`
}

type KeyValue struct {
	Key   string `yaml:"key"`
	Value string `yaml:"value"`
}

type ParamValue struct {
	Value string `yaml:"value"`
}
