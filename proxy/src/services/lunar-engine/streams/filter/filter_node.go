package streamfilter

import (
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"

	"github.com/rs/zerolog/log"
)

type FlowResult struct {
	Flow      []internaltypes.FlowI
	FlowValid bool
}

type FilterResult struct {
	UserFlow        FlowResult
	SystemFlowStart FlowResult
	SystemFlowEnd   FlowResult
}

func (f *FilterResult) Extend(other internaltypes.FilterTreeResultI) {
	if userFlow, valid := other.GetUserFlow(); valid {
		if !f.UserFlow.FlowValid {
			f.UserFlow.Flow = userFlow
			f.UserFlow.FlowValid = true
		} else {
			f.UserFlow.Flow = append(f.UserFlow.Flow, userFlow...)
		}
	}
	if systemFlowStart, valid := other.GetSystemFlowStart(); valid {
		if !f.SystemFlowStart.FlowValid {
			f.SystemFlowStart.Flow = systemFlowStart
			f.SystemFlowStart.FlowValid = true
		} else {
			f.SystemFlowStart.Flow = append(f.SystemFlowStart.Flow, systemFlowStart...)
		}
	}
	if systemFlowEnd, valid := other.GetSystemFlowEnd(); valid {
		if !f.SystemFlowEnd.FlowValid {
			f.SystemFlowEnd.Flow = systemFlowEnd
			f.SystemFlowEnd.FlowValid = true
		} else {
			f.SystemFlowEnd.Flow = append(f.SystemFlowEnd.Flow, systemFlowEnd...)
		}
	}
}

func (f *FilterResult) GetUserFlow() ([]internaltypes.FlowI, bool) {
	return f.UserFlow.Flow, f.UserFlow.FlowValid
}

func (f *FilterResult) GetSystemFlowStart() ([]internaltypes.FlowI, bool) {
	return f.SystemFlowStart.Flow, f.SystemFlowStart.FlowValid
}

func (f *FilterResult) GetSystemFlowEnd() ([]internaltypes.FlowI, bool) {
	return f.SystemFlowEnd.Flow, f.SystemFlowEnd.FlowValid
}

func (f *FilterResult) IsEmpty() bool {
	return !f.UserFlow.FlowValid && !f.SystemFlowStart.FlowValid && !f.SystemFlowEnd.FlowValid
}

type FilterNode struct {
	userFlows       []internaltypes.FlowI
	systemFlowStart []internaltypes.FlowI
	systemFlowEnd   []internaltypes.FlowI
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
	node.userFlows = append(node.userFlows, flow)
	return nil
}

/*
Get flow based on the API stream,
the function will validate the stream based on the filter
*/
func (node *FilterNode) getFlow(
	apiStream publictypes.APIStreamI,
) (*FilterResult, bool) {
	// TODO: this way to find the correct flow is not efficient, we should find a better way.
	userFlow, userFlowValid := node.getUserFlow(apiStream)
	systemFlowStart, systemFlowStartValid := node.getSystemFlow(
		apiStream, internaltypes.SystemFlowStart)
	systemFlowEnd, systemFlowEndValid := node.getSystemFlow(apiStream, internaltypes.SystemFlowEnd)

	filterTreeRes := &FilterResult{
		UserFlow:        FlowResult{Flow: userFlow, FlowValid: userFlowValid},
		SystemFlowStart: FlowResult{Flow: systemFlowStart, FlowValid: systemFlowStartValid},
		SystemFlowEnd:   FlowResult{Flow: systemFlowEnd, FlowValid: systemFlowEndValid},
	}
	if filterTreeRes.IsEmpty() {
		return nil, false
	}

	return filterTreeRes, true
}

func (node *FilterNode) getUserFlow(
	apiStream publictypes.APIStreamI,
) ([]internaltypes.FlowI, bool) {
	// TODO: this way to find the correct flow is not efficient, we should find a better way.
	userFlows := []internaltypes.FlowI{}
	for _, flow := range node.userFlows {
		if isValid := node.isFlowValid(flow, apiStream); !isValid {
			continue
		}
		userFlows = append(userFlows, flow)
	}
	return userFlows, len(userFlows) > 0
}

func (node *FilterNode) getSystemFlow(
	apiStream publictypes.APIStreamI,
	flowType internaltypes.FlowType,
) ([]internaltypes.FlowI, bool) {
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

	return SystemFlowRes, len(SystemFlowRes) > 0
}

func (node *FilterNode) isFlowValid(
	flow internaltypes.FlowI,
	apiStream publictypes.APIStreamI,
) bool {
	if !flow.GetFilter().ShouldAllowSample() {
		return false
	}

	if flow.GetFilter().IsExpressionFilter() {
		return node.validateExpr(flow, apiStream)
	}
	return node.validate(flow, apiStream)
}

func (node *FilterNode) validateExpr(
	flow internaltypes.FlowI,
	apiStream publictypes.APIStreamI,
) bool {
	filter := flow.GetFilter()

	var expr []string
	if apiStream.GetType().IsRequestType() {
		expr = filter.GetReqExpressions()
	} else if apiStream.GetType().IsResponseType() {
		expr = filter.GetResExpressions()
	} else {
		return false
	}

	for _, expr := range expr {
		result, err := apiStream.JSONPathQuery(expr)
		if err != nil {
			log.Error().Msgf("Failed to query JSON: %s", err)
		} else {
			if len(result) == 0 {
				return false
			}
		}
	}

	return true
}

func (node *FilterNode) validate(
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
