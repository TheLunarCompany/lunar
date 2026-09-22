package utils

import (
	"bytes"
	"fmt"
	"io"
	"lunar/async-service/config"
	stream_types "lunar/engine/streams/types"
	context_manager "lunar/toolkit-core/context-manager"
	"net/http"

	"github.com/rs/zerolog/log"
)

var globalClient = &http.Client{}

func ToRequestMessage(request *http.Request) *stream_types.OnRequest {
	lunarURL := fmt.Sprintf("http://localhost:%s%s", config.GetEngineBindPort(), request.URL.String())
	onRequest := &stream_types.OnRequest{
		Body:       ReadBody(request.Body),
		ID:         request.Header.Get(HeaderLunarRequestID),
		SequenceID: request.Header.Get(HeaderLunarRequestID),
		Method:     request.Method,
		Scheme:     request.Header.Get(HeaderLunarScheme),
		URL:        lunarURL,
		Path:       request.URL.Path,
		Query:      request.URL.RawQuery,
		Headers:    HeadersToMap(request.Header),
		Time:       context_manager.Get().GetClock().Now(),
	}
	return onRequest
}

func ToResponseMessage(response *http.Response) *stream_types.OnResponse {
	body, err := io.ReadAll(response.Body)
	if err != nil {
		log.Error().Msgf("Error reading response body: %s", err)
		return nil
	}

	onResponse := &stream_types.OnResponse{
		ID:         response.Header.Get(HeaderLunarRequestID),
		SequenceID: response.Header.Get(HeaderLunarRequestID),

		Body:    string(body),
		Status:  response.StatusCode,
		Headers: HeadersToMap(response.Header),
		Time:    context_manager.Get().GetClock().Now(),
	}

	return onResponse
}

func HeadersToMap(headers http.Header) map[string]string {
	result := make(map[string]string)
	for key, values := range headers {
		if len(values) > 0 {
			result[key] = values[0] // Take the first value for each header key
		}
	}
	return result
}

func ReadBody(body io.ReadCloser) string {
	defer func() {
		if err := body.Close(); err != nil {
			log.Warn().Err(err).Msg("Failed to close request body")
		}
	}()

	data, err := io.ReadAll(body)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to read request body")
		return ""
	}
	return string(data)
}

func MakeRequest(req *stream_types.OnRequest) (*stream_types.OnResponse, error) {
	if req == nil {
		return nil, fmt.Errorf("request is nil")
	}

	var body io.Reader
	if len(req.Body) > 0 {
		body = bytes.NewBuffer([]byte(req.Body))
	}
	req.URL = fmt.Sprintf("http://localhost:%s%s", config.GetEngineBindPort(), req.Path)
	request, err := http.NewRequest(req.Method, req.URL, body)
	if err != nil {
		return nil, fmt.Errorf("error creating request: %w", err)
	}

	for key, value := range req.Headers {
		request.Header.Set(key, value)
	}

	response, err := globalClient.Do(request)
	if err != nil {
		return nil, fmt.Errorf("error making request: %w", err)
	}

	if response.StatusCode == http.StatusNotAcceptable {
		return nil, fmt.Errorf("error: %s", response.Status)
	}

	responseMessage := ToResponseMessage(response)
	return responseMessage, nil
}
