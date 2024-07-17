package resourcetypes

import (
	streamconfig "lunar/engine/streams/config"
	publictypes "lunar/engine/streams/public-types"
)

type ResourceFlowData struct {
	Filter                *streamconfig.Filter
	ProcessorsConnections publictypes.ResourceFlowI
	Processors            map[string]publictypes.ProcessorDataI
	ID                    string
}

type ResourceFlow struct {
	Request  *ResourceProcessorLocation
	Response *ResourceProcessorLocation
}

type ResourceProcessorLocation struct {
	End   []string
	Start []string
}
