package internaltypes

import publictypes "lunar/engine/streams/public-types"

type FilterTreeI interface {
	AddFlow(FlowI) error
	GetFlow(APIStream publictypes.APIStreamI) []FilterTreeResultI
}

type FilterTreeResultI interface {
	GetUserFlow() FlowI
	GetSystemFlowStart() []FlowI
	GetSystemFlowEnd() []FlowI
}
