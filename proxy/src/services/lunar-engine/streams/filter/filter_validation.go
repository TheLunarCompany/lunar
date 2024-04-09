package streamfilter

import (
	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
)

func (node *FilterNode) isHeadersQualified(APIStream *streamtypes.APIStream) bool {
	/* Check if stream headers are qualified based on the filter */
	for _, header := range node.filter.Headers {
		if !APIStream.Request.DoesHeaderValueMatch(header.Key, header.Value) {
			return false
		}
	}
	return true
}

func (node *FilterNode) isStatusCodeQualified(APIStream *streamtypes.APIStream) bool {
	/* Check if stream status code is qualified based on the filter */
	if len(node.filter.StatusCode) == 0 {
		log.Trace().Msgf("Status code not specified")
		return true
	}
	for _, statusCode := range node.filter.StatusCode {
		if statusCode == APIStream.Response.Status {
			log.Trace().Msg("Status code is qualified")
			return true
		}
	}
	log.Trace().Msg("Status code not qualified")
	return false
}

func (node *FilterNode) isMethodQualified(APIStream *streamtypes.APIStream) bool {
	/* Check if stream method is qualified based on the filter */
	if len(node.filter.Method) == 0 {
		log.Trace().Msgf("Method not specified")
		return true
	}
	for _, method := range node.filter.Method {
		if method == APIStream.Request.Method {
			log.Trace().Msgf("Method qualified")
			return true
		}
	}
	log.Trace().Msgf("Method not qualified")
	return false
}

func (node *FilterNode) isQueryParamsQualified(APIStream *streamtypes.APIStream) bool {
	/* Check if stream query params are qualified based on the filter */
	if len(node.filter.QueryParams) == 0 {
		log.Trace().Msgf("Query params not specified")
		return true
	}
	for _, queryParam := range node.filter.QueryParams {
		if exists, err := APIStream.Request.DoesQueryParamExist(queryParam.Key); !exists {
			log.Trace().Err(err).Msgf("Query param %s not found", queryParam.Key)
			return false
		}
		if queryMatch, _ := APIStream.Request.DoesQueryParamValueMatch(
			queryParam.Key,
			queryParam.Value,
		); !queryMatch {
			log.Trace().Msgf("Query param %s value not matched", queryParam.Key)
			return false
		}
	}

	log.Trace().Msgf("Query params qualified")
	return true
}
