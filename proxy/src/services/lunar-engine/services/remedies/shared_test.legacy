package remedies_test

import (
	lunarMessages "lunar/engine/messages"
	"time"
)

// TODO: rename (remove 1)
func onRequestArgs() lunarMessages.OnRequest {
	return lunarMessages.OnRequest{
		ID:         "1234-5678-9012-3456",
		SequenceID: "3333-3333-3333-3333",
		Method:     "GET",
		Scheme:     "http",
		URL:        "test.com/some/path",
		Path:       "/some/path",
		Query:      "abc=123&def=456",
		Headers:    map[string]string{},
		Body:       "{ \"some\": \"json\" }",
		Time:       time.Now(),
	}
}

func basicRequestArgs(
	headers map[string]string,
	body string,
) lunarMessages.OnRequest {
	return lunarMessages.OnRequest{
		ID:         "1234-5678-9012-3456",
		SequenceID: "3333-3333-3333-3333",
		Method:     "GET",
		Scheme:     "http",
		URL:        "test.com/some/path",
		Path:       "/some/path",
		Query:      "abc=123&def=456",
		Headers:    headers,
		Body:       body,
		Time:       time.Now(),
	}
}

func basicResponseArgs(
	status int,
	body string,
	headers map[string]string,
) lunarMessages.OnResponse {
	return lunarMessages.OnResponse{
		ID:         "1234-5678-9012-3456",
		SequenceID: "1234-5678-9012-3456",
		Method:     "GET",
		URL:        "test.com/some/path",
		Status:     status,
		Headers:    headers,
		Body:       body,
		Time:       time.Now(),
	}
}
