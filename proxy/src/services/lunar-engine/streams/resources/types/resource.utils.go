package resourcetypes

import (
	streamconfig "lunar/engine/streams/config"
	publictypes "lunar/engine/streams/public-types"
)

func (rfd *ResourceFlowData) GetFilter() *streamconfig.Filter {
	return rfd.Filter
}

func (rfd *ResourceFlowData) GetID() string {
	return rfd.ID
}

func (rfd *ResourceFlowData) GetProcessorsConnections() publictypes.ResourceFlowI {
	return rfd.ProcessorsConnections
}

func (rfd *ResourceFlowData) GetProcessors() map[string]*streamconfig.Processor {
	return rfd.Processors
}

func (rf *ResourceFlow) GetRequest() publictypes.ResourceProcessorLocationI {
	if rf.Request == nil {
		rf.Request = &ResourceProcessorLocation{}
	}
	return rf.Request
}

func (rf *ResourceFlow) GetResponse() publictypes.ResourceProcessorLocationI {
	if rf.Response == nil {
		rf.Response = &ResourceProcessorLocation{}
	}
	return rf.Response
}

func (rpl *ResourceProcessorLocation) GetEnd() []string {
	if rpl.End == nil {
		rpl.End = []string{}
	}
	return rpl.End
}

func (rpl *ResourceProcessorLocation) GetStart() []string {
	if rpl.Start == nil {
		rpl.Start = []string{}
	}
	return rpl.Start
}

func (rpl *ResourceProcessorLocation) AddConnections(
	processorLocation publictypes.ResourceProcessorLocationI,
) {
	rpl.AddToStart(processorLocation.GetStart())
	rpl.AddToEnd(processorLocation.GetEnd())
}

func (rpl *ResourceProcessorLocation) AddToStart(processorKeys []string) {
	rpl.Start = append(rpl.Start, processorKeys...)
}

func (rpl *ResourceProcessorLocation) AddToEnd(processorKeys []string) {
	rpl.End = append(rpl.End, processorKeys...)
}
