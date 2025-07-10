package streamfilter

import (
	internal_types "lunar/engine/streams/internal-types"
	public_types "lunar/engine/streams/public-types"

	"github.com/rs/zerolog/log"
)

// Check if stream headers are qualified based on the filter
func (node *FilterNode) isHeadersQualified(
	flow internal_types.FlowI,
	APIStream public_types.APIStreamI,
) bool {
	flowFilter := flow.GetFilter()
	var allowedHeaders public_types.KVOpParam
	var transaction public_types.TransactionI

	if APIStream.GetActionsType().IsRequestType() {
		allowedHeaders = flowFilter.GetAllowedReqHeaders()
		transaction = APIStream.GetRequest()
	} else {
		allowedHeaders = flowFilter.GetAllowedResHeaders()
		transaction = APIStream.GetResponse()
	}

	if allowedHeaders.IsEmpty() {
		log.Trace().Msgf("Headers not specified on Flow: %s", flow.GetName())
		return true
	}

	if APIStream.GetActionsType().IsRequestType() {
		// request headers use AND operand
		return allowedHeaders.EvaluateOpWithAndOperand(transaction.GetHeader, "Header", flow.GetName())
	}

	// response headers use OR operand
	return allowedHeaders.EvaluateOpWithOrOperand(transaction.GetHeader, "Header", flow.GetName())
}

// Check if stream status code is qualified based on the filter
func (node *FilterNode) isStatusCodeQualified(
	flow internal_types.FlowI,
	APIStream public_types.APIStreamI,
) bool {
	if APIStream.GetType().IsRequestType() {
		return true
	}

	flowFilter := flow.GetFilter()
	allowedStatusCodeParam := flowFilter.GetAllowedStatusCodes()
	if allowedStatusCodeParam.IsEmpty() {
		log.Trace().Msgf("Status code not specified for Flow: %s", flow.GetName())
		return true
	}

	resp := APIStream.GetResponse()
	if resp == nil {
		return false
	}

	if allowedStatusCodeParam.Contains(resp.GetStatus()) {
		log.Trace().Msgf("Status code is qualified for Flow: %s", flow.GetName())
		return true
	}

	log.Trace().Msgf("Status code not qualified on Flow: %s", flow.GetName())
	return false
}

// Check if stream method is qualified based on the filter
func (node *FilterNode) isMethodQualified(
	flow internal_types.FlowI,
	APIStream public_types.APIStreamI,
) bool {
	flowFilter := flow.GetFilter()

	for _, method := range flowFilter.GetSupportedMethods() {
		if method == APIStream.GetMethod() {
			log.Trace().Str("LookFor", method).Str("Needs", APIStream.GetMethod()).
				Msgf("Method qualified for Flow: %s", flow.GetName())
			return true
		}
	}
	log.Trace().Str("Needs", APIStream.GetMethod()).
		Msgf("Method not qualified for Flow: %s", flow.GetName())
	return false
}

// Check if stream query params are qualified based on the filter
func (node *FilterNode) isQueryParamsQualified(
	flow internal_types.FlowI,
	APIStream public_types.APIStreamI,
) bool {
	if APIStream.GetType().IsResponseType() {
		return true
	}

	flowFilterQueryParams := flow.GetFilter().GetAllowedQueryParams()
	if flowFilterQueryParams.IsEmpty() {
		log.Trace().Msgf("Query params not specified on Flow: %s", flow.GetName())
		return true
	}

	// CORE-1894, CORE-1836 - StreamFilter should use OR operand between cases
	return flowFilterQueryParams.EvaluateOpWithOrOperand(
		APIStream.GetRequest().GetQueryParam,
		"QueryParam",
		flow.GetName(),
	)
}
