package streamfilter

import (
	internal_types "lunar/engine/streams/internal-types"
	streamtypes "lunar/engine/streams/types"
	"lunar/toolkit-core/urltree"

	"github.com/rs/zerolog/log"
)

// Ensure interface is implemented
var _ internal_types.FilterTreeI = &FilterTree{}

type FilterTree struct {
	tree *urltree.URLTree[FilterNode]
}

func NewFilterTree() internal_types.FilterTreeI {
	return &FilterTree{
		tree: urltree.NewURLTree[FilterNode](),
	}
}

// Add a flow with specified filter to the filter tree
func (f *FilterTree) AddFlow(flow internal_types.FlowI) error {
	filter := flow.GetFilter()
	return f.tree.Insert(filter.URL, &FilterNode{
		filter: &filter,
		flow:   flow,
	})
}

// Get flow based on the API stream
func (f *FilterTree) GetFlow(APIStream *streamtypes.APIStream) internal_types.FlowI {
	lookupResult := f.tree.Lookup(APIStream.Request.URL)
	if lookupResult.Value == nil {
		log.Trace().Msgf("No filter found for %v", APIStream.Request.URL)
		return nil
	}
	filterNode := *lookupResult.Value
	return filterNode.getFlow(APIStream)
}
