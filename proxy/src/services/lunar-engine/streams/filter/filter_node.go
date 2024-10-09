package streamfilter

import (
	"fmt"
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"

	"github.com/rs/zerolog/log"
)

var errAddFlow = fmt.Errorf("failed to add flow to filter node")

type FilterNode struct {
	flows              []internaltypes.FlowI
	filterRequirements nodeFilterRequirements
}

func (node *FilterNode) addFlow(flow internaltypes.FlowI) error {
	if err := node.validateHeaders(flow); err != nil {
		log.Warn().Err(err).Msg(filterConfigurationGuide)
		return errAddFlow
	}

	if err := node.validateStatusCode(flow); err != nil {
		log.Warn().Err(err).Msg(filterConfigurationGuide)
		return errAddFlow
	}

	if err := node.validateMethod(flow); err != nil {
		log.Warn().Err(err).Msg(filterConfigurationGuide)
		return errAddFlow
	}

	if err := node.validateQueryParams(flow); err != nil {
		log.Warn().Err(err).Msg(filterConfigurationGuide)
		return errAddFlow
	}

	node.flows = append(node.flows, flow)
	return nil
}

/*
Get flow based on the API stream,
the function will validate the stream based on the filter
*/
func (node *FilterNode) getFlow(apiStream publictypes.APIStreamI) internaltypes.FlowI {
	// TODO: this way to find the correct flow is not efficient, we should find a better way.
	for _, flow := range node.flows {
		if !node.isHeadersQualified(flow, apiStream) {
			continue
		}

		if !node.isStatusCodeQualified(flow, apiStream) {
			continue
		}

		if !node.isMethodQualified(flow, apiStream) {
			continue
		}

		if !node.isQueryParamsQualified(flow, apiStream) {
			continue
		}

		return flow
	}
	return nil
}
