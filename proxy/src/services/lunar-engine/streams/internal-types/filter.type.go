package internaltypes

import publictypes "lunar/engine/streams/public-types"

type FilterTreeI interface {
	AddFlow(FlowI) error
	GetFlow(APIStream publictypes.APIStreamI) ([]FilterTreeResultI, bool)
}

type FilterTreeResultI interface {
	GetUserFlow() ([]FlowI, bool)
	GetSystemFlowStart() ([]FlowI, bool)
	GetSystemFlowEnd() ([]FlowI, bool)
}
