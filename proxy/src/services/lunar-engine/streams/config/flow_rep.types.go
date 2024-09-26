package streamconfig

import (
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	"lunar/toolkit-core/network"
)

// Implementation of FlowRepresentationInterface
func (f *FlowRepresentation) GetName() string {
	return f.Name
}

func (f *FlowRepresentation) GetFilter() publictypes.FilterI {
	return f.Filter
}

func (f *FlowRepresentation) SetFilter(filter publictypes.FilterI) {
	if f.Filter != nil {
		f.Filter = nil
	}
	f.Filter = filter.(*Filter)
}

func (f *FlowRepresentation) AddProcessor(name string, processor publictypes.ProcessorDataI) {
	f.Processors[name] = processor.(*Processor)
}

func (f *FlowRepresentation) GetProcessors() map[string]publictypes.ProcessorDataI {
	// Convert the map to a map of ProcessorInterface
	processorMap := make(map[string]publictypes.ProcessorDataI)
	for key, proc := range f.Processors {
		processorMap[key] = proc
	}
	return processorMap
}

func (f *FlowRepresentation) GetFlow() internaltypes.FlowGraphRepI {
	return &f.Flow
}

func (f *FlowRepresentation) GetData() network.ConfigurationPayload {
	return f.Data
}

func (f *FlowRepresentation) SetID(id string) {
	f.Name = id
}

func (f *FlowRepresentation) SetProcessors(processors map[string]publictypes.ProcessorDataI) {
	if f.Processors != nil {
		f.Processors = nil
	}
	f.Processors = make(map[string]*Processor)
	for key, proc := range processors {
		f.Processors[key] = proc.(*Processor)
	}
}

func (f *Flow) GetFlowConnections(streamType publictypes.StreamType) []internaltypes.FlowConnRepI {
	switch streamType {
	case publictypes.StreamTypeRequest:
		return f.GetRequest()
	case publictypes.StreamTypeResponse:
		return f.GetResponse()
		// handle StreamTypeAny case
	case publictypes.StreamTypeAny:
		// handle StreamTypeMirror case
	case publictypes.StreamTypeMirror:
	}
	return nil
}

// Implementation of FlowInterface
func (f *Flow) GetRequest() []internaltypes.FlowConnRepI {
	requestConnections := make([]internaltypes.FlowConnRepI, len(f.Request))
	for i, conn := range f.Request {
		requestConnections[i] = conn
	}
	return requestConnections
}

func (f *Flow) GetResponse() []internaltypes.FlowConnRepI {
	responseConnections := make([]internaltypes.FlowConnRepI, len(f.Response))
	for i, conn := range f.Response {
		responseConnections[i] = conn
	}
	return responseConnections
}

func (f *Flow) SetRequest(requestConnections []internaltypes.FlowConnRepI) {
	if f.Request != nil {
		f.Request = nil
	}
	f.Request = make([]*FlowConnection, len(requestConnections))
	for i, conn := range requestConnections {
		f.Request[i] = conn.(*FlowConnection)
	}
}

func (f *Flow) SetResponse(responseConnections []internaltypes.FlowConnRepI) {
	if f.Response != nil {
		f.Response = nil
	}
	f.Response = make([]*FlowConnection, len(responseConnections))
	for i, conn := range responseConnections {
		f.Response[i] = conn.(*FlowConnection)
	}
}

// Implementation of FlowConnectionInterface
func (fc *FlowConnection) GetFrom() internaltypes.ConnectionRepI {
	return fc.From
}

func (fc *FlowConnection) GetTo() internaltypes.ConnectionRepI {
	return fc.To
}

func (fc *FlowConnection) SetTo(to internaltypes.ConnectionRepI) {
	if fc.To != nil {
		fc.To = nil
	}
	fc.To = to.(*Connection)
}

func (fc *FlowConnection) SetFrom(from internaltypes.ConnectionRepI) {
	if fc.From != nil {
		fc.From = nil
	}
	fc.From = from.(*Connection)
}

// Implementation of ConnectionInterface
func (c *Connection) GetStream() internaltypes.StreamRefI {
	if c.Stream == nil {
		return nil
	}
	return c.Stream
}

func (c *Connection) GetFlow() internaltypes.FlowRefI {
	if c.Flow == nil {
		return nil
	}
	return c.Flow
}

func (c *Connection) GetProcessor() internaltypes.ProcessorRefI {
	if c.Processor == nil {
		return nil
	}
	return c.Processor
}

func (c *Connection) SetStream(streamRef internaltypes.StreamRefI) {
	if c.Stream != nil {
		c.Stream = nil
	}
	c.Stream = streamRef.(*StreamRef)
}

func (c *Connection) SetFlow(flowRef internaltypes.FlowRefI) {
	if c.Flow != nil {
		c.Flow = nil
	}
	c.Flow = flowRef.(*FlowRef)
}

func (c *Connection) SetProcessor(processorRef internaltypes.ProcessorRefI) {
	if c.Processor != nil {
		c.Processor = nil
	}
	c.Processor = processorRef.(*ProcessorRef)
}

// Implementation of FlowRefInterface
func (fr *FlowRef) GetName() string {
	return fr.Name
}

func (fr *FlowRef) GetAt() string {
	return fr.At
}

// Implementation of StreamRefInterface
func (sr *StreamRef) GetName() string {
	return sr.Name
}

func (sr *StreamRef) GetAt() string {
	return sr.At
}

// Implementation of ProcessorRefInterface
func (pr *ProcessorRef) GetName() string {
	return pr.Name
}

func (pr *ProcessorRef) GetCondition() string {
	return pr.Condition
}

func (f *Filter) GetQueryParams() []publictypes.KeyValue {
	return f.QueryParams
}

func (f *Filter) GetMethod() []string {
	return f.Method
}

func (f *Filter) GetHeaders() []publictypes.KeyValue {
	return f.Headers
}

func (f *Filter) GetStatusCode() []int {
	return f.StatusCode
}

// Implementation of ProcessorInterface
func (p *Processor) GetProcessor() string {
	return p.Processor
}

func (p *Processor) GetParameters() []*publictypes.KeyValue {
	return p.Parameters
}