package streamfilter

import (
	streamconfig "lunar/engine/streams/config"
	streamflow "lunar/engine/streams/flow"
	streamtypes "lunar/engine/streams/types"
	"lunar/toolkit-core/urltree"

	"github.com/rs/zerolog/log"
)

type FilterTree struct {
	tree *urltree.URLTree[FilterNode]
}

func NewFilterTree() *FilterTree {
	return &FilterTree{
		tree: urltree.NewURLTree[FilterNode](),
	}
}

func (f *FilterTree) AddFlow(filter *streamconfig.Filter, flow *streamflow.Flow) error {
	/* Add a flow with specified filter to the filter tree */

	return f.tree.Insert(filter.URL, &FilterNode{
		filter: filter,
		flow:   flow,
	})
}

func (f *FilterTree) GetFlow(APIStream *streamtypes.APIStream) *streamflow.Flow {
	/* Get flow based on the API stream */

	lookupResult := f.tree.Lookup(APIStream.Request.URL)
	if lookupResult.Value == nil {
		log.Trace().Msgf("No filter found for %v", APIStream.Request.URL)
		return nil
	}
	filterNode := *lookupResult.Value
	return filterNode.getFlow(APIStream)
}
