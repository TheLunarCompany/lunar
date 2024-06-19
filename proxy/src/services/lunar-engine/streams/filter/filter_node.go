package streamfilter

import (
	streamconfig "lunar/engine/streams/config"
	internal_types "lunar/engine/streams/internal-types"
	streamtypes "lunar/engine/streams/types"
)

type FilterNode struct {
	filter *streamconfig.Filter
	flow   internal_types.FlowI
}

func (node *FilterNode) getFlow(apiStream *streamtypes.APIStream) internal_types.FlowI {
	/* Get flow based on the API stream,
	   the function will validate the stream based on the filter */
	if !node.isHeadersQualified(apiStream) {
		return nil
	}

	if apiStream.Response != nil && !node.isStatusCodeQualified(apiStream) {
		return nil
	}

	if !node.isMethodQualified(apiStream) {
		return nil
	}

	if apiStream.Request != nil && !node.isQueryParamsQualified(apiStream) {
		return nil
	}

	return node.flow
}
