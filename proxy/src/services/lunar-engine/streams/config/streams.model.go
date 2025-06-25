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
	Name             string                           `yaml:"name"`
	URL              string                           `yaml:"url"`
	QueryParams      []public_types.KeyValueOperation `yaml:"query_params,omitempty"`
	Method           []string                         `yaml:"method,omitempty"`
	Headers          []public_types.KeyValueOperation `yaml:"headers,omitempty"`
	ResponseHeaders  []public_types.KeyValueOperation `yaml:"response_headers,omitempty"`
	StatusCode       []int                            `yaml:"status_code,omitempty"`
	Expressions      []string                         `yaml:"expressions,omitempty"`
	SamplePercentage float64                          `yaml:"sample_percentage,omitempty"`
	flowRequirements *stream_types.ProcessorRequirement
	expression       *Expression
}

type Expression struct {
	req []string `yaml:"req,omitempty"`
	res []string `yaml:"res,omitempty"`
}

// This will assist in comparing the filters, we drop the name as it is not relevant for comparison.
type Processor struct {
	Processor  string                         `yaml:"processor"`
	Parameters []*public_types.KeyValue       `yaml:"parameters,omitempty"`
	Metrics    *public_types.ProcessorMetrics `yaml:"metrics,omitempty"`
	// Key will be set by the engine as a unique key for the processor
	Key string
}
