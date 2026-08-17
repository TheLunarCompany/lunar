package streamtypes

import (
	"encoding/json"
	"fmt"
	lunar_messages "lunar/engine/messages"
	public_types "lunar/engine/streams/public-types"
	"lunar/engine/utils"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

func NewResponse(onResponse lunar_messages.OnResponse) public_types.TransactionI {
	bodyMap := make(map[string]any)
	parsedBody, err := DecodeBody(onResponse.RawBody, onResponse.Headers["content-encoding"])
	if err != nil {
		log.Error().Err(err).Msgf("failed to decode body: %s", onResponse.ID)
	} else {
		if err := json.Unmarshal([]byte(parsedBody), &bodyMap); err != nil {
			_ = json.Unmarshal(onResponse.RawBody, &bodyMap)
		}
	}
	return &OnResponse{
		ID:         onResponse.ID,
		SequenceID: onResponse.SequenceID,
		Method:     onResponse.Method,
		URL:        onResponse.URL,
		Status:     onResponse.Status,
		Headers:    onResponse.Headers,
		Body:       parsedBody,
		BodyMap:    bodyMap,
		Time:       onResponse.Time,
	}
}

func (res *OnResponse) IsNewSequence() bool {
	return res.ID == res.SequenceID
}

func (res *OnResponse) DoesHeaderExist(headerName string) bool {
	_, found := res.GetHeader(headerName)
	return found
}

func (res *OnResponse) DoesHeaderValueMatch(headerName, headerValue string) bool {
	if existingHeaderValue, found := res.GetHeader(headerName); found {
		return strings.EqualFold(existingHeaderValue, headerValue)
	}
	return false
}

func (res *OnResponse) GetSize() int {
	if res.Size > 0 {
		return res.Size
	}

	if sizeStr, ok := res.Headers["Content-Length"]; ok {
		size, _ := strconv.Atoi(sizeStr)
		res.Size = size
		return res.Size
	}

	if res.Body != "" {
		res.Size = len(res.Body)
		return len(res.Body)
	}
	return 0
}

func (res *OnResponse) GetQueryParam(_ string) (string, bool) {
	return "", false
}

func (res *OnResponse) DoesQueryParamExist(string) bool {
	return false
}

func (res *OnResponse) DoesQueryParamValueMatch(string, string) bool {
	return false
}

func (res *OnResponse) GetID() string {
	return res.ID
}

func (res *OnResponse) GetSequenceID() string {
	return res.SequenceID
}

func (res *OnResponse) GetMethod() string {
	return res.Method
}

func (res *OnResponse) GetURL() string {
	return res.URL
}

func (res *OnResponse) GetParsedURL() *url.URL {
	return nil
}

func (res *OnResponse) GetScheme() string {
	return ""
}

func (res *OnResponse) GetPath() string {
	return ""
}

func (res *OnResponse) GetQuery() string {
	return ""
}

func (res *OnResponse) GetHost() string {
	return utils.ExtractHost(res.URL)
}

func (res *OnResponse) GetStatus() int {
	return res.Status
}

func (res *OnResponse) GetHeader(key string) (string, bool) {
	// TODO: can we make this more efficient by storing the headers in lowercase?
	value, found := res.Headers[strings.ToLower(key)]
	if !found {
		return "", false
	}
	return value, true
}

func (res *OnResponse) GetHeaders() map[string]string {
	return res.Headers
}

func (res *OnResponse) GetBody() string {
	return res.Body
}

func (res *OnResponse) GetTime() time.Time {
	return res.Time
}

func (res *OnResponse) UpdateBodyFromBodyMap() {
	if len(res.BodyMap) == 0 {
		return
	}
	bodyBytes, err := json.Marshal(res.BodyMap)
	if err != nil {
		log.Warn().Err(err).Msgf("failed to marshal body: %s", res.ID)
		return
	}
	res.Body = string(bodyBytes)
	res.Headers["content-length"] = strconv.Itoa(len(res.Body))

	res.UpdateSize()
}

func (res *OnResponse) UpdateSize() {
	sizeStr := res.Headers["Content-Length"]
	if sizeStr == "" {
		sizeStr = res.Headers["content-length"]
	}
	size, err := strconv.Atoi(sizeStr)
	if err != nil {
		res.Size = len(res.Body)
	} else {
		res.Size = size
	}
}

// NewResponseAPIStream creates a new APIStream with the given OnResponse
func NewResponseAPIStream(
	onResponse lunar_messages.OnResponse,
	sharedState public_types.SharedStateI[[]byte],
) public_types.APIStreamI {
	name := fmt.Sprintf("ResponseAPIStream-%s", onResponse.ID)
	apiStream := NewAPIStream(name, public_types.StreamTypeResponse, sharedState)
	apiStream.SetResponse(NewResponse(onResponse))
	return apiStream
}

func (res *OnResponse) ToJSON() ([]byte, error) {
	return json.Marshal(res)
}
