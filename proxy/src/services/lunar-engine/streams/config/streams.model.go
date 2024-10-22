package streamconfig

import (
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	"lunar/toolkit-core/network"
)

type FlowRepresentation struct {
	Name       string                `yaml:"name"`
	Filter     *Filter               `yaml:"filter"`
	Processors map[string]*Processor `yaml:"processors"` // key (processor key)
	Flow       Flow                  `yaml:"flow"`
	Data       network.ConfigurationPayload
	Type       internaltypes.FlowType
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
	Name      string `yaml:"name"`                // processor key
	Condition string `yaml:"condition,omitempty"` // Linked Processor Output
}

type Filter struct {
	Name        string                 `yaml:"name"`
	URL         string                 `yaml:"url"`
	QueryParams []publictypes.KeyValue `yaml:"query_params,omitempty"`
	Method      []string               `yaml:"method,omitempty"`
	Headers     []publictypes.KeyValue `yaml:"headers,omitempty"`
	StatusCode  []int                  `yaml:"status_code,omitempty"`
}

// This will assist in comparing the filters, we drop the name as it is not relevant for comparison.
type Processor struct {
	Processor  string                        `yaml:"processor"`
	Parameters []*publictypes.KeyValue       `yaml:"parameters,omitempty"`
	Metrics    *publictypes.ProcessorMetrics `yaml:"metrics,omitempty"`
	// Key will be set by the engine as a unique key for the processor
	Key string
}
