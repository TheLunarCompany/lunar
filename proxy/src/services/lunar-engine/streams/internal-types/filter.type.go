package internaltypes

import publictypes "lunar/engine/streams/public-types"

type FilterTreeI interface {
	AddFlow(FlowI) error
	GetFlow(APIStream publictypes.APIStreamI) []FlowI
}
