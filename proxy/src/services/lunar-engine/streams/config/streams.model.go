package streamconfig

type FlowRepresentation struct {
	Name       string               `yaml:"name"`
	Filters    Filter               `yaml:"filters"`
	Processors map[string]Processor `yaml:"processors"` // key (processor key)
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
	Name string `yaml:"name"` // name of the flow to connect from|into
	At   string `yaml:"at"`   // (start | end)
}

type StreamRef struct {
	Name string `yaml:"name"`
	At   string `yaml:"at"` // (start | end)
}
type ProcessorRef struct {
	Name string `yaml:"name"`         // processor key
	On   string `yaml:"on,omitempty"` // Linked Processor Output
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
	Processor  string     `yaml:"processor"`
	Parameters []KeyValue `yaml:"parameters,omitempty"`
}

type KeyValue struct {
	Key   string `yaml:"key"`
	Value string `yaml:"value"`
}
