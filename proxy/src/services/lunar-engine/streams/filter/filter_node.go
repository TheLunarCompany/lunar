package streamfilter

import (
	"fmt"
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"

	"github.com/rs/zerolog/log"
)

var errAddFlow = fmt.Errorf("failed to add flow to filter node")

type FilterResult struct {
	UserFlow        internaltypes.FlowI
	SystemFlowStart []internaltypes.FlowI
	SystemFlowEnd   []internaltypes.FlowI
}

func (f *FilterResult) GetUserFlow() internaltypes.FlowI {
	return f.UserFlow
}

func (f *FilterResult) GetSystemFlowStart() []internaltypes.FlowI {
	return f.SystemFlowStart
}

func (f *FilterResult) GetSystemFlowEnd() []internaltypes.FlowI {
	return f.SystemFlowEnd
}

func (f *FilterResult) IsEmpty() bool {
	return f.UserFlow == nil && len(f.SystemFlowStart) == 0 && len(f.SystemFlowEnd) == 0
}

type FilterNode struct {
	userFlows          []internaltypes.FlowI
	systemFlowStart    []internaltypes.FlowI
	systemFlowEnd      []internaltypes.FlowI
	filterRequirements nodeFilterRequirements
}

func (node *FilterNode) addSystemFlowStart(flow internaltypes.FlowI) error {
	node.systemFlowStart = append(node.systemFlowStart, flow)
	return nil
}

func (node *FilterNode) addSystemFlowEnd(flow internaltypes.FlowI) error {
	node.systemFlowEnd = append(node.systemFlowEnd, flow)
	return nil
}

func (node *FilterNode) addUserFlow(flow internaltypes.FlowI) error {
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

	node.userFlows = append(node.userFlows, flow)
	return nil
}

/*
Get flow based on the API stream,
the function will validate the stream based on the filter
*/
func (node *FilterNode) getFlow(apiStream publictypes.APIStreamI) internaltypes.FilterTreeResultI {
	// TODO: this way to find the correct flow is not efficient, we should find a better way.
	filterTreeRes := &FilterResult{
		UserFlow:        node.getUserFlow(apiStream),
		SystemFlowStart: node.getSystemFlow(apiStream, internaltypes.SystemFlowStart),
		SystemFlowEnd:   node.getSystemFlow(apiStream, internaltypes.SystemFlowEnd),
	}
	if filterTreeRes.IsEmpty() {
		return nil
	}

	return filterTreeRes
}

func (node *FilterNode) getUserFlow(apiStream publictypes.APIStreamI) internaltypes.FlowI {
	// TODO: this way to find the correct flow is not efficient, we should find a better way.
	for _, flow := range node.userFlows {
		if isValid := node.isFlowValid(flow, apiStream); !isValid {
			continue
		}
		return flow
	}
	return nil
}

func (node *FilterNode) getSystemFlow(
	apiStream publictypes.APIStreamI,
	flowType internaltypes.FlowType,
) []internaltypes.FlowI {
	// TODO: this way to find the correct flow is not efficient, we should find a better way.
	SystemFlowRes := []internaltypes.FlowI{}
	var systemFlow []internaltypes.FlowI

	switch flowType { //nolint:exhaustive
	case internaltypes.SystemFlowStart:
		systemFlow = node.systemFlowStart
	case internaltypes.SystemFlowEnd:
		systemFlow = node.systemFlowEnd
	}
	for _, flow := range systemFlow {
		if isValid := node.isFlowValid(flow, apiStream); !isValid {
			continue
		}
		SystemFlowRes = append(SystemFlowRes, flow)
	}

	return SystemFlowRes
}

func (node *FilterNode) isFlowValid(
	flow internaltypes.FlowI,
	apiStream publictypes.APIStreamI,
) bool {
	if !node.isHeadersQualified(flow, apiStream) {
		return false
	}

	if !node.isStatusCodeQualified(flow, apiStream) {
		return false
	}

	if !node.isMethodQualified(flow, apiStream) {
		return false
	}

	if !node.isQueryParamsQualified(flow, apiStream) {
		return false
	}
	return true
}
