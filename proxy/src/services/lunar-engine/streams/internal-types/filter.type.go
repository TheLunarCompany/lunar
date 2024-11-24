package internaltypes

import publictypes "lunar/engine/streams/public-types"

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
