package streamtypes

import (
	"encoding/json"
	"fmt"
	lunarMessages "lunar/engine/messages"
	public_types "lunar/engine/streams/public-types"
	"lunar/engine/utils"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// NewRequestAPIStream creates a new APIStream with the given OnRequest
func NewRequestAPIStream(
	onRequest lunarMessages.OnRequest,
	sharedState public_types.SharedStateI[[]byte],
) public_types.APIStreamI {
	name := fmt.Sprintf("RequestAPIStream-%s", onRequest.ID)
	apiStream := NewAPIStream(name, public_types.StreamTypeRequest, sharedState)
	apiStream.SetRequest(NewRequest(onRequest))
	return apiStream
}

func NewRequest(onRequest lunarMessages.OnRequest) public_types.TransactionI {
	parsedBody, err := DecodeBody(onRequest.RawBody, onRequest.Headers["content-encoding"])
	if err != nil {
		log.Error().Err(err).Msgf("failed to decode body: %s", onRequest.ID)
	}

	return &OnRequest{
		ID:         onRequest.ID,
		SequenceID: onRequest.SequenceID,
		Method:     onRequest.Method,
		Scheme:     onRequest.Scheme,
		URL:        onRequest.URL,
		Path:       onRequest.Path,
		Query:      onRequest.Query,
		Headers:    onRequest.Headers,
		Body:       parsedBody,
		Time:       onRequest.Time,
	}
}

func (req *OnRequest) init() error {
	if req.ParsedURL != nil {
		return nil
	}

	if sizeStr, ok := req.Headers["Content-Length"]; ok {
		size, _ := strconv.Atoi(sizeStr)
		req.Size = size
	} else {
		req.Size = len(req.Body)
	}

	urlWithQueryString := fmt.Sprintf(
		"%s://%s?%s",
		req.Scheme,
		req.URL,
		req.Query,
	)
	parsedURL, err := url.Parse(urlWithQueryString)
	if err != nil {
		return err
	}
	req.ParsedURL = parsedURL
	req.ParsedQuery = parsedURL.Query()

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
		log.Error().Err(err).Msgf("failed to initialize request: %s", req.ID)
		return false
	}
	_, found := req.ParsedURL.Query()[paramName]
	return found
}

func (req *OnRequest) DoesQueryParamValueMatch(paramName, paramValue string) bool {
	queryExists := req.DoesQueryParamExist(paramName)
	if !queryExists {
		return queryExists
	}

	return req.ParsedURL.Query().Get(paramName) == paramValue
}

func (req *OnRequest) GetSize() int {
	if err := req.init(); err != nil {
		return -1
	}
	return req.Size
}

func (req *OnRequest) IsNewSequence() bool {
	return req.ID == req.SequenceID
}

func (req *OnRequest) GetID() string {
	return req.ID
}

func (req *OnRequest) GetSequenceID() string {
	return req.SequenceID
}

func (req *OnRequest) GetMethod() string {
	return req.Method
}

func (req *OnRequest) GetURL() string {
	return req.URL
}

func (req *OnRequest) GetParsedURL() *url.URL {
	if err := req.init(); err != nil {
		log.Error().Err(err).Msgf("failed to initialize request: %s", req.ID)
		return nil
	}
	return req.ParsedURL
}

func (req *OnRequest) GetScheme() string {
	return req.Scheme
}

func (req *OnRequest) GetPath() string {
	return req.Path
}

func (req *OnRequest) GetQuery() string {
	return req.Query
}

func (req *OnRequest) GetHost() string {
	return utils.ExtractHost(req.URL)
}

func (req *OnRequest) GetHeader(key string) (string, bool) {
	// TODO: can we make this more efficient by storing the headers in lowercase?
	value, found := req.Headers[strings.ToLower(key)]
	if !found {
		return "", false
	}
	return value, true
}

func (req *OnRequest) GetHeaders() map[string]string {
	return req.Headers
}

func (req *OnRequest) GetBody() string {
	return req.Body
}

func (req *OnRequest) GetTime() time.Time {
	return req.Time
}

func (req *OnRequest) GetStatus() int {
	return 0
}

func (req *OnRequest) ToJSON() ([]byte, error) {
	return json.Marshal(req)
}
