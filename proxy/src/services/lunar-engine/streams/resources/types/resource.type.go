package resourcetypes

import (
	publictypes "lunar/engine/streams/public-types"
)

type ResourceFlowData struct {
	Filter                publictypes.FilterI
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
