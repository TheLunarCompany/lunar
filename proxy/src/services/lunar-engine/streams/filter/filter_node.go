package streamfilter

import (
	internal_types "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
)

type FilterNode struct {
	filter publictypes.FilterI
	flow   internal_types.FlowI
}

func (node *FilterNode) getFlow(apiStream publictypes.APIStreamI) internal_types.FlowI {
	/* Get flow based on the API stream,
	   the function will validate the stream based on the filter */
	if !node.isHeadersQualified(apiStream) {
		return nil
	}

	if apiStream.GetResponse() != nil && !node.isStatusCodeQualified(apiStream) {
		return nil
	}

	if !node.isMethodQualified(apiStream) {
		return nil
	}

	if apiStream.GetRequest() != nil && !node.isQueryParamsQualified(apiStream) {
		return nil
	}

	return node.flow
}
