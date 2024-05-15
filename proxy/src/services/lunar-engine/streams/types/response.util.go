package streamtypes

import (
	"fmt"
	"lunar/engine/messages"
	"strconv"
)

func (res *OnResponse) IsNewSequence() bool {
	return res.ID == res.SequenceID
}

func (res *OnResponse) DoesHeaderExist(headerName string) bool {
	_, found := res.Headers[headerName]
	return found
}

func (res *OnResponse) DoesHeaderValueMatch(headerName, headerValue string) bool {
	if !res.DoesHeaderExist(headerName) {
		return false
	}
	return res.Headers[headerName] == headerValue
}

func (res *OnResponse) Size() int {
	if res.size > 0 {
		return res.size
	}

	if sizeStr, ok := res.Headers["Content-Length"]; ok {
		size, _ := strconv.Atoi(sizeStr)
		res.size = size
		return res.size
	}

	if res.Body != "" {
		res.size = len(res.Body)
		return len(res.Body)
	}
	return res.size
}

// NewResponseAPIStream creates a new APIStream with the given OnResponse
func NewResponseAPIStream(onResponse messages.OnResponse) *APIStream {
	name := fmt.Sprintf("ResponseAPIStream-%s", onResponse.ID)
	apiStream := &APIStream{
		Name: name,
		Type: StreamTypeResponse,
		Response: &OnResponse{
			ID:         onResponse.ID,
			SequenceID: onResponse.SequenceID,
			Method:     onResponse.Method,
			URL:        onResponse.URL,
			Status:     onResponse.Status,
			Headers:    onResponse.Headers,
			Body:       onResponse.Body,
			Time:       onResponse.Time,
		},
	}
	return apiStream
}
