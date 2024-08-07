package streamfilter

import (
	publictypes "lunar/engine/streams/public-types"

	"github.com/rs/zerolog/log"
)

func (node *FilterNode) isHeadersQualified(APIStream publictypes.APIStreamI) bool {
	/* Check if stream headers are qualified based on the filter */
	for _, data := range node.filter.GetAllowedHeaders() {
		if data.GetParamValue() == nil {
			log.Trace().Msgf("Header %s value not specified", data.Key)
			continue
		}
		if APIStream.GetType().IsRequestType() || APIStream.GetType().IsAnyType() {
			if !APIStream.GetRequest().DoesHeaderValueMatch(data.Key, data.GetParamValue().GetString()) {
				return false
			}
		} else if !APIStream.GetResponse().
			DoesHeaderValueMatch(data.Key, data.GetParamValue().GetString()) {
			return false
		}
	}
	return true
}

func (node *FilterNode) isStatusCodeQualified(APIStream publictypes.APIStreamI) bool {
	/* Check if stream status code is qualified based on the filter */
	if len(node.filter.GetAllowedStatusCodes()) == 0 {
		log.Trace().Msgf("Status code not specified")
		return true
	}
	for _, statusCode := range node.filter.GetAllowedStatusCodes() {
		if statusCode == APIStream.GetResponse().GetStatus() {
			log.Trace().Msg("Status code is qualified")
			return true
		}
	}
	log.Trace().Msg("Status code not qualified")
	return false
}

func (node *FilterNode) isMethodQualified(APIStream publictypes.APIStreamI) bool {
	/* Check if stream method is qualified based on the filter */
	if len(node.filter.GetAllowedMethods()) == 0 {
		log.Trace().Msgf("Method not specified")
		return true
	}
	for _, method := range node.filter.GetSupportedMethods() {
		if method == APIStream.GetMethod() {
			log.Trace().Msgf("Method qualified")
			return true
		}
	}
	log.Trace().Msgf("Method not qualified")
	return false
}

func (node *FilterNode) isQueryParamsQualified(APIStream publictypes.APIStreamI) bool {
	/* Check if stream query params are qualified based on the filter */
	if len(node.filter.GetAllowedQueryParams()) == 0 {
		log.Trace().Msgf("Query params not specified")
		return true
	}
	for _, data := range node.filter.GetAllowedQueryParams() {
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
