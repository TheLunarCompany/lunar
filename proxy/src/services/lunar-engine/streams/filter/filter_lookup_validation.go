package streamfilter

import (
	internaltypes "lunar/engine/streams/internal-types"
	publictypes "lunar/engine/streams/public-types"

	"github.com/rs/zerolog/log"
)

/*
TODO:
	We need to support JSONPath to enable
	- Body matching
	- This qualified validation works for the request, but we need to add support for the response.
	- Only status code is checked for the response.
*/

// Check if stream headers are qualified based on the filter
func (node *FilterNode) isHeadersQualified(
	flow internaltypes.FlowI,
	APIStream publictypes.APIStreamI,
) bool {
	if APIStream.GetType().IsResponseType() {
		return true
	}

	if flow.IsUserFlow() && len(node.filterRequirements.headers) == 0 {
		log.Trace().Msgf("Headers not specified on Flow: %s", flow.GetName())
		return true
	}

	flowFilter := flow.GetFilter()

	if len(flowFilter.GetAllowedHeaders()) == 0 {
		log.Trace().Msgf("Headers not specified on Flow: %s", flow.GetName())
		return true
	}
	// TODO: Create this map only once
	// and reuse it for all the streams
	headerMap := make(map[string][]string)
	for _, data := range flowFilter.GetAllowedHeaders() {
		headerMap[data.Key] = append(headerMap[data.Key], data.GetParamValue().GetString())
	}
	for key, values := range headerMap {
		if node.isHeaderValueValid(key, values, APIStream) {
			log.Trace().Msgf("Header %s value matched on Flow: %s", key, flow.GetName())
			continue
		}
		log.Trace().Msgf("Header %s not qualified on Flow: %s", key, flow.GetName())
		return false
	}
	return true
}

// Check if stream status code is qualified based on the filter
func (node *FilterNode) isStatusCodeQualified(
	flow internaltypes.FlowI,
	APIStream publictypes.APIStreamI,
) bool {
	if flow.IsUserFlow() && len(node.filterRequirements.statusCodes) == 0 {
		log.Trace().Msgf("Status code not specified for %s", flow.GetName())
		return true
	}

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
	flow internaltypes.FlowI,
	APIStream publictypes.APIStreamI,
) bool {
	if flow.IsUserFlow() && len(node.filterRequirements.methods) == 0 {
		log.Trace().Msgf("Method not specified on Flow: %s", flow.GetName())
		return true
	}

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
	flow internaltypes.FlowI,
	APIStream publictypes.APIStreamI,
) bool {
	if APIStream.GetType().IsResponseType() {
		return true
	}

	if flow.IsUserFlow() && len(node.filterRequirements.queryParams) == 0 {
		log.Trace().Msgf("Query params not specified")
		return true
	}

	flowFilter := flow.GetFilter()

	for _, data := range flowFilter.GetAllowedQueryParams() {
		if exists := APIStream.GetRequest().DoesQueryParamExist(data.Key); !exists {
			log.Trace().Msgf("Query param %s not found on Flow: %s", data.Key, flow.GetName())
			return false
		}

		if data.GetParamValue() == nil {
			log.Trace().Msgf("Query param %s value not specified for Flow: %s", data.Key, flow.GetName())
			continue
		}

		if queryMatch := APIStream.GetRequest().DoesQueryParamValueMatch(
			data.Key,
			data.GetParamValue().GetString(),
		); !queryMatch {
			log.Trace().Msgf("Query param %s value not matched Flow: %s", data.Key, flow.GetName())
			return false
		}
	}

	log.Trace().Msgf("Query params qualified for Flow: %s", flow.GetName())
	return true
}

// Validates if one of the relevant header value is accepted
func (node *FilterNode) isHeaderValueValid(
	headerKey string,
	headerValues []string,
	APIStream publictypes.APIStreamI,
) bool {
	for _, value := range headerValues {
		if APIStream.DoesHeaderValueMatch(headerKey, value) {
			return true
		}
		log.Trace().Msgf("Header %s value not matched to: %s on ReqID: %s",
			headerKey, value, APIStream.GetID())
		log.Trace().Msgf("Available header values: %v", APIStream.GetHeaders())
	}
	return false
}
