package streamconfig

import (
	internal_types "lunar/engine/streams/internal-types"
	public_types "lunar/engine/streams/public-types"
	stream_types "lunar/engine/streams/types"
	"lunar/toolkit-core/network"
)

type FlowRepresentation struct {
	Name       string                `yaml:"name"`
	Filter     *Filter               `yaml:"filter"`
	Processors map[string]*Processor `yaml:"processors"` // key (processor key)
	Flow       Flow                  `yaml:"flow"`
	Data       network.ConfigurationPayload
	Type       internal_types.FlowType
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

type ProcessorName struct {
	Name      string
	CreatedBy string
}

type ProcessorRef struct {
	Name          string `yaml:"name"`                // processor key
	Condition     string `yaml:"condition,omitempty"` // Linked Processor Output
	CreatedByFlow string
	ReferenceName string
}

type Filter struct {
	Name             string                            `yaml:"name"`
	URL              string                            `yaml:"url"`
	URLs             []string                          `yaml:"urls"`
	PathParams       public_types.KVOpParam            `yaml:"path_params,omitempty"`
	QueryParams      public_types.KVOpParam            `yaml:"query_params,omitempty"`
	Method           []string                          `yaml:"method,omitempty"`
	Methods          []string                          `yaml:"methods,omitempty"`
	Headers          public_types.KVOpParam            `yaml:"headers,omitempty"`
	ResponseHeaders  public_types.KVOpParam            `yaml:"response_headers,omitempty"`
	StatusCode       public_types.StatusCodeParam      `yaml:"status_code,omitempty"`
	Expressions      public_types.KVOpExpressionsParam `yaml:"expressions,omitempty"`
	SamplePercentage float64                           `yaml:"sample_percentage,omitempty"`
	flowRequirements *stream_types.ProcessorRequirement
}

// Processor assists in comparing the filters,
// dropping the name as it is not relevant for comparison.
type Processor struct {
	Processor  string                         `yaml:"processor"`
	Parameters []*public_types.KeyValue       `yaml:"parameters,omitempty"`
	Metrics    *public_types.ProcessorMetrics `yaml:"metrics,omitempty"`
	// Key will be set by the engine as a unique key for the processor
	Key string
}
