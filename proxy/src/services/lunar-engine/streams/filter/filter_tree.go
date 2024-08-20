package streamfilter

import (
	internal_types "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
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
		tree: urltree.NewURLTree[FilterNode](false, 0),
	}
}

// Add a flow with specified filter to the filter tree
func (f *FilterTree) AddFlow(flow internal_types.FlowI) error {
	filter := flow.GetFilter()
	return f.tree.Insert(filter.GetURL(), &FilterNode{
		filter: &filter,
		flow:   flow,
	})
}

// Get flow based on the API stream
func (f *FilterTree) GetFlow(APIStream publictypes.APIStreamI) internal_types.FlowI {
	url := APIStream.GetURL()
	lookupResult := f.tree.Lookup(url)
	if lookupResult.Value == nil {
		log.Trace().Msgf("No filter found for %v", url)
		return nil
	}
	filterNode := *lookupResult.Value
	return filterNode.getFlow(APIStream)
}
