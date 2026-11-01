package internaltypes

import (
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
)

type FilterTreeI interface {
	AddFlow(FlowI) error
	GetFlow(publictypes.APIStreamI) (FilterTreeResultI, bool)
}

type FilterTreeResultI interface {
	Extend(FilterTreeResultI)
	GetUserFlow() ([]FlowI, bool)
	GetSystemFlowStart() ([]FlowI, bool)
	GetSystemFlowEnd() ([]FlowI, bool)
}

type FlowFilterI interface {
	publictypes.FilterI
	GetRequirements() *streamtypes.ProcessorRequirement
	SetBodyRequired(bool)
	SetReqCaptureRequired(bool)
}
