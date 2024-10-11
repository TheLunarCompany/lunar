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

/* Check if stream headers are qualified based on the filter */
func (node *FilterNode) isHeadersQualified(
	flow internaltypes.FlowI,
	APIStream publictypes.APIStreamI,
) bool {
	if APIStream.GetType().IsResponseType() {
		return true
	}

	if len(node.filterRequirements.headers) == 0 {
		log.Trace().Msgf("Headers not specified")
		return true
	}

	flowFilter := flow.GetFilter()
	for _, data := range flowFilter.GetAllowedHeaders() {
		if data.GetParamValue() == nil {
			log.Trace().Msgf("Header %s value not specified", data.Key)
			continue
		}

		if !APIStream.DoesHeaderValueMatch(data.Key, data.GetParamValue().GetString()) {
			log.Trace().Msgf("Header %s value not matched", data.Key)
			return false
		}
	}
	return true
}

func (node *FilterNode) isStatusCodeQualified(
	flow internaltypes.FlowI,
	APIStream publictypes.APIStreamI,
) bool {
	/* Check if stream status code is qualified based on the filter */

	if len(node.filterRequirements.statusCodes) == 0 {
		log.Trace().Msgf("Status code not specified")
		return true
	}

	if APIStream.GetType().IsRequestType() {
		return true
	}
	flowFilter := flow.GetFilter()
	for _, statusCode := range flowFilter.GetAllowedStatusCodes() {
		if statusCode == APIStream.GetResponse().GetStatus() {
			log.Trace().Msg("Status code is qualified")
			return true
		}
	}
	log.Trace().Msg("Status code not qualified")
	return false
}

func (node *FilterNode) isMethodQualified(
	flow internaltypes.FlowI,
	APIStream publictypes.APIStreamI,
) bool {
	/* Check if stream method is qualified based on the filter */

	if APIStream.GetType().IsResponseType() {
		return true
	}

	if len(node.filterRequirements.methods) == 0 {
		log.Trace().Msgf("Method not specified")
		return true
	}

	flowFilter := flow.GetFilter()

	for _, method := range flowFilter.GetAllowedMethods() {
		if method == APIStream.GetMethod() {
			log.Trace().Msgf("Method qualified")
			return true
		}
	}
	log.Trace().Msgf("Method not qualified")
	return false
}

func (node *FilterNode) isQueryParamsQualified(
	flow internaltypes.FlowI,
	APIStream publictypes.APIStreamI,
) bool {
	/* Check if stream query params are qualified based on the filter */

	if APIStream.GetType().IsResponseType() {
		return true
	}

	if len(node.filterRequirements.queryParams) == 0 {
		log.Trace().Msgf("Query params not specified")
		return true
	}

	flowFilter := flow.GetFilter()

	for _, data := range flowFilter.GetAllowedQueryParams() {
		if exists := APIStream.GetRequest().DoesQueryParamExist(data.Key); !exists {
			log.Trace().Msgf("Query param %s not found", data.Key)
			return false
		}

		if data.GetParamValue() == nil {
			log.Trace().Msgf("Query param %s value not specified", data.Key)
			return true
		}

		if queryMatch := APIStream.GetRequest().DoesQueryParamValueMatch(
			data.Key,
			data.GetParamValue().GetString(),
		); !queryMatch {
			log.Trace().Msgf("Query param %s value not matched", data.Key)
			return false
		}
	}

	log.Trace().Msgf("Query params qualified")
	return true
}