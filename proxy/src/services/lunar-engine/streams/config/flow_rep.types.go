package streamconfig

import (
	"fmt"
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	streamTypes "lunar/engine/streams/types"
	"lunar/toolkit-core/network"
	"strings"

	"gopkg.in/yaml.v3"
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

func (f *FlowRepresentation) SetType(flowType internaltypes.FlowType) {
	f.Type = flowType
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

func (f *FlowRepresentation) GetType() internaltypes.FlowType {
	return f.Type
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

func (f *Flow) SetFlowConnections(
	streamType publictypes.StreamType,
	connections []internaltypes.FlowConnRepI,
) []internaltypes.FlowConnRepI {
	switch streamType {
	case publictypes.StreamTypeRequest:
		f.SetRequest(connections)
	case publictypes.StreamTypeResponse:
		f.SetResponse(connections)
		// handle StreamTypeAny case
	case publictypes.StreamTypeAny:
		// handle StreamTypeMirror case
	case publictypes.StreamTypeMirror:
	}
	return nil
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

func (pr *ProcessorRef) GetName() string {
	return pr.Name
}

func (pr *ProcessorRef) GetCondition() string {
	return pr.Condition
}

func (pr *ProcessorRef) GetReferenceName() string {
	return pr.ReferenceName
}

func (pr *ProcessorRef) GetCreatedByFlow() string {
	return pr.CreatedByFlow
}

func (pr *ProcessorRef) UnmarshalYAML(value *yaml.Node) error {
	type Alias ProcessorRef
	temp := Alias{}

	if err := value.Decode(&temp); err != nil {
		return err
	}

	*pr = ProcessorRef(temp)

	return pr.parseRef()
}

func (pr *ProcessorRef) parseRef() error {
	pr.ReferenceName = pr.Name
	keyParts := strings.Split(pr.Name, ".")

	if len(keyParts) == 2 {
		pr.CreatedByFlow = keyParts[0]
		pr.Name = keyParts[1]
	} else if len(keyParts) == 1 {
		pr.Name = keyParts[0]
	} else {
		return fmt.Errorf(
			"invalid processor key: %s, processor key should only contain '.' when created by another flow",
			pr.Name)
	}
	return nil
}

// Implementation of ProcessorInterface
func (p *Processor) GetProcessor() string {
	return p.Processor
}

func (p *Processor) GetParameters() []*publictypes.KeyValue {
	return p.Parameters
}

func (f *Filter) GetRequirements() *streamTypes.ProcessorRequirement {
	if f.flowRequirements == nil {
		f.flowRequirements = &streamTypes.ProcessorRequirement{}
	}

	return f.flowRequirements
}

func (f *Filter) SetBodyRequired(bodyRequired bool) {
	if f.flowRequirements == nil {
		f.flowRequirements = &streamTypes.ProcessorRequirement{}
	}
	f.flowRequirements.IsBodyRequired = bodyRequired
}

func (f *Filter) SetReqCaptureRequired(reqCaptureRequired bool) {
	if f.flowRequirements == nil {
		f.flowRequirements = &streamTypes.ProcessorRequirement{}
	}
	f.flowRequirements.IsReqCaptureRequired = reqCaptureRequired
}
