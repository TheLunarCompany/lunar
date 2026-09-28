package lunarmessages

import (
	"lunar/engine/utils"
	"strings"
)

func (request *OnRequest) DeepCopy() OnRequest {
	return OnRequest{
		ID:             strings.Clone(request.ID),
		SequenceID:     strings.Clone(request.SequenceID),
		Method:         strings.Clone(request.Method),
		Scheme:         strings.Clone(request.Scheme),
		URL:            strings.Clone(request.URL),
		Path:           strings.Clone(request.Path),
		Query:          strings.Clone(request.Query),
		Headers:        utils.DeepCopyHeaders(request.Headers),
		Body:           strings.Clone(request.Body),
		Time:           request.Time,
		parsedURL:      request.parsedURL,
		parsedURLParts: request.parsedURLParts,
	}
}

func (response *OnResponse) DeepCopy() OnResponse {
	return OnResponse{
		ID:         strings.Clone(response.ID),
		SequenceID: strings.Clone(response.SequenceID),
		Method:     strings.Clone(response.Method),
		URL:        strings.Clone(response.URL),
		Status:     response.Status, // int is immutable
		Headers:    utils.DeepCopyHeaders(response.Headers),
		Body:       strings.Clone(response.Body),
		Time:       response.Time,
	}
}
