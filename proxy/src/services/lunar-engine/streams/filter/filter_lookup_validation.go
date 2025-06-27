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
	var allowedHeaders []public_types.KeyValueOperation
	var transaction public_types.TransactionI

	if APIStream.GetActionsType().IsRequestType() {
		allowedHeaders = flowFilter.GetAllowedReqHeaders()
		transaction = APIStream.GetRequest()
	} else {
		allowedHeaders = flowFilter.GetAllowedResHeaders()
		transaction = APIStream.GetResponse()
	}

	if len(allowedHeaders) == 0 {
		log.Trace().Msgf("Headers not specified on Flow: %s", flow.GetName())
		return true
	}

	for _, op := range allowedHeaders {
		if op.EvaluateOp(transaction.GetHeader(op.Key)) {
			log.Trace().Msgf("Header %s value matched on Flow: %s", op.Key, flow.GetName())
			continue
		}
		log.Trace().Msgf("Header %s not qualified on Flow: %s", op.Key, flow.GetName())
		return false
	}
	return true
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
	allowedStatusCodes := flowFilter.GetAllowedStatusCodes()
	if len(allowedStatusCodes) == 0 {
		log.Trace().Msgf("Status code not specified for Flow: %s", flow.GetName())
		return true
	}

	for _, statusCode := range allowedStatusCodes {
		if statusCode == APIStream.GetResponse().GetStatus() {
			log.Trace().Msgf("Status code is qualified for Flow: %s", flow.GetName())
			return true
		}
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

	flowFilter := flow.GetFilter()

	for _, data := range flowFilter.GetAllowedQueryParams() {
		if data.EvaluateOp(APIStream.GetRequest().GetQueryParam(data.Key)) {
			log.Trace().Msgf("Query param %s value matched on Flow: %s", data.Key, flow.GetName())
			continue
		}
		log.Trace().Msgf("Query param %s not qualified on Flow: %s", data.Key, flow.GetName())
		return false
	}

	log.Trace().Msgf("Query params qualified for Flow: %s", flow.GetName())
	return true
}
