package streamfilter

import (
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	"lunar/toolkit-core/urltree"

	"github.com/rs/zerolog/log"
)

// Ensure interface is implemented
var _ internaltypes.FilterTreeI = &FilterTree{}

type FilterTree struct {
	tree *urltree.URLTree[FilterNode]
}

func NewFilterTree() internaltypes.FilterTreeI {
	return &FilterTree{
		tree: urltree.NewURLTree[FilterNode](false, 0),
	}
}

// Add a flow with specified filter to the filter tree
func (f *FilterTree) AddFlow(flow internaltypes.FlowI) error {
	filter := flow.GetFilter()
	return f.tree.InsertDeclaredURL(filter.GetURL(), &FilterNode{
		filter: filter,
		flow:   flow,
	})
}

// Get flow based on the API stream
func (f *FilterTree) GetFlow(
	APIStream publictypes.APIStreamI,
) []internaltypes.FlowI {
	url := APIStream.GetURL()
	lookupResult := f.tree.Traversal(url)
	if lookupResult.Value == nil || len(lookupResult.Value) == 0 {
		log.Trace().Msgf("No filter found for %v", url)
		return nil
	}

	filterNode := lookupResult.Value
	flows := []internaltypes.FlowI{}
	for _, node := range filterNode {
		flow := node.getFlow(APIStream)
		if flow != nil {
			flows = append(flows, flow)
		}
	}
	return flows
}
