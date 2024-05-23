package internaltypes

import (
	streamtypes "lunar/engine/streams/types"
)

type FilterTreeI interface {
	AddFlow(flow FlowI) error
	GetFlow(APIStream *streamtypes.APIStream) FlowI
}
