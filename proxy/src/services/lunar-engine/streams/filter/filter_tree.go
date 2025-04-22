package streamfilter

import (
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"
	"lunar/toolkit-core/urltree"

	"github.com/rs/zerolog/log"
)

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
	result := f.tree.Lookup(filter.GetURL())
	if result.Match && result.NormalizedURL == filter.GetURL() {
		log.Debug().Msgf("Adding %s flow to existing filter tree: %v",
			flow.GetType().String(), filter.GetURL())
		switch flow.GetType() {
		case internaltypes.UserFlow:
			return result.Value.addUserFlow(flow)
		case internaltypes.SystemFlowStart:
			return result.Value.addSystemFlowStart(flow)
		case internaltypes.SystemFlowEnd:
			return result.Value.addSystemFlowEnd(flow)
		}
	}
	var filterNode *FilterNode

	log.Debug().Msgf("Adding %s flow to filter tree: %v", flow.GetType().String(), filter.GetURL())
	switch flow.GetType() {
	case internaltypes.UserFlow:
		filterNode = &FilterNode{
			userFlows:          []internaltypes.FlowI{flow},
			systemFlowStart:    []internaltypes.FlowI{},
			systemFlowEnd:      []internaltypes.FlowI{},
			filterRequirements: newFilterRequirements(flow),
		}
	case internaltypes.SystemFlowStart:
		filterNode = &FilterNode{
			userFlows:          []internaltypes.FlowI{},
			systemFlowStart:    []internaltypes.FlowI{flow},
			systemFlowEnd:      []internaltypes.FlowI{},
			filterRequirements: newFilterRequirements(nil),
		}
	case internaltypes.SystemFlowEnd:
		filterNode = &FilterNode{
			userFlows:          []internaltypes.FlowI{},
			systemFlowStart:    []internaltypes.FlowI{},
			systemFlowEnd:      []internaltypes.FlowI{flow},
			filterRequirements: newFilterRequirements(nil),
		}
	}
	return f.tree.InsertDeclaredURL(filter.GetURL(), filterNode)
}

// Get flow based on the API stream
func (f *FilterTree) GetFlow(
	APIStream publictypes.APIStreamI,
) (internaltypes.FilterTreeResultI, bool) {
	flows := &FilterResult{}
	url := APIStream.GetURL()
	lookupResult := f.tree.Traversal(url)
	if len(lookupResult.Value) == 0 {
		log.Trace().Msgf("No filter found for %v - %v", url, lookupResult.Value)
		return nil, false
	}

	filterNode := lookupResult.Value
	found := false
	for _, node := range filterNode {
		flowNode, valid := node.getFlow(APIStream)
		if valid {
			flows.Extend(flowNode)
			found = true
		}
	}

	return flows, found
}
