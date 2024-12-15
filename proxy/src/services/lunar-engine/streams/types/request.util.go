package streamtypes

import (
	"fmt"
	lunarMessages "lunar/engine/messages"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/utils"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// NewRequestAPIStream creates a new APIStream with the given OnRequest
func NewRequestAPIStream(onRequest lunarMessages.OnRequest) publictypes.APIStreamI {
	name := fmt.Sprintf("RequestAPIStream-%s", onRequest.ID)
	apiStream := NewAPIStream(name, publictypes.StreamTypeRequest)
	apiStream.SetRequest(NewRequest(onRequest))
	return apiStream
}

func NewRequest(onRequest lunarMessages.OnRequest) publictypes.TransactionI {
	return &OnRequest{
		id:         onRequest.ID,
		sequenceID: onRequest.SequenceID,
		method:     onRequest.Method,
		scheme:     onRequest.Scheme,
		url:        onRequest.URL,
		path:       onRequest.Path,
		query:      onRequest.Query,
		headers:    onRequest.Headers,
		body:       onRequest.Body,
		time:       onRequest.Time,
	}
}

func (req *OnRequest) init() error {
	if req.parsedURL != nil {
		return nil
	}

	if sizeStr, ok := req.headers["Content-Length"]; ok {
		size, _ := strconv.Atoi(sizeStr)
		req.size = size
	} else {
		req.size = len(req.body)
	}

	urlWithQueryString := fmt.Sprintf(
		"%s://%s?%s",
		req.scheme,
		req.url,
		req.query,
	)
	parsedURL, err := url.Parse(urlWithQueryString)
	if err != nil {
		return err
	}
	req.parsedURL = parsedURL
	req.parsedQuery = parsedURL.Query()

	return nil
}

func (req *OnRequest) DoesHeaderExist(headerName string) bool {
	_, found := req.GetHeader(headerName)
	return found
}

func (req *OnRequest) DoesHeaderValueMatch(headerName, headerValue string) bool {
	if existingHeaderValue, found := req.GetHeader(headerName); found {
		return strings.EqualFold(existingHeaderValue, headerValue)
	}
	return false
}

func (req *OnRequest) DoesQueryParamExist(paramName string) bool {
	if err := req.init(); err != nil {
		log.Error().Err(err).Msgf("failed to initialize request: %s", req.id)
		return false
	}
	_, found := req.parsedURL.Query()[paramName]
	return found
}

func (req *OnRequest) DoesQueryParamValueMatch(paramName, paramValue string) bool {
	queryExists := req.DoesQueryParamExist(paramName)
	if !queryExists {
		return queryExists
	}

	return req.parsedURL.Query().Get(paramName) == paramValue
}

func (req *OnRequest) Size() int {
	if err := req.init(); err != nil {
		return -1
	}
	return req.size
}

func (req *OnRequest) IsNewSequence() bool {
	return req.id == req.sequenceID
}

func (req *OnRequest) GetID() string {
	return req.id
}

func (req *OnRequest) GetSequenceID() string {
	return req.sequenceID
}

func (req *OnRequest) GetMethod() string {
	return req.method
}

func (req *OnRequest) GetURL() string {
	return req.url
}

func (req *OnRequest) GetHost() string {
	return utils.ExtractHost(req.url)
}

func (req *OnRequest) GetHeader(key string) (string, bool) {
	// TODO: can we make this more efficient by storing the headers in lowercase?
	value, found := utils.MakeHeadersLowercase(req.headers)[strings.ToLower(key)]
	if !found {
		return "", false
	}
	return value, true
}

func (req *OnRequest) GetHeaders() map[string]string {
	return req.headers
}

func (req *OnRequest) GetBody() string {
	return req.body
}

func (req *OnRequest) GetTime() time.Time {
	return req.time
}

func (req *OnRequest) GetStatus() int {
	return 0
}
