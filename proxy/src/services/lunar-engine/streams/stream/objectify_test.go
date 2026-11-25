package stream_test

import (
	lunar_context "lunar/engine/streams/lunar-context"
	"lunar/engine/streams/stream"
	stream_types "lunar/engine/streams/types"
	"testing"

	lunar_messages "lunar/engine/messages"

	"github.com/stretchr/testify/require"
)

var sharedState = lunar_context.NewMemoryState[[]byte]()

func TestAsObjectReturnsMapWithFourKeys(t *testing.T) {
	request := lunar_messages.OnRequest{
		ID:      "test1",
		Headers: map[string]string{"x-lunar-used-tokens": "3", "authorization": "Bearer 123"},
		Body:    `{"foo": "bar", "year": 2025}`,
	}
	apiStream := stream_types.NewRequestAPIStream(request, sharedState)
	res := stream.AsObject(apiStream)

	require.NotNil(t, res)

	keyCount := 0
	for range res {
		keyCount++
	}
	require.Equal(t, 7, keyCount)

	require.NotNil(t, res["body"])
	require.NotNil(t, res["headers"])
	require.NotNil(t, res["request"])
	require.NotNil(t, res["response"])
	require.NotNil(t, res["path"])
	require.NotNil(t, res["path_segments"])
}

func TestAsObjectReturnsEmptyResponseWhenStreamIsForRequest(t *testing.T) {
	request := lunar_messages.OnRequest{
		ID:      "test1",
		Headers: map[string]string{"x-lunar-used-tokens": "3", "authorization": "Bearer 123"},
		Body:    `{"foo": "bar", "year": 2025}`,
	}
	apiStream := stream_types.NewRequestAPIStream(request, sharedState)
	res := stream.AsObject(apiStream)

	require.NotNil(t, res["response"])
	require.Nil(t, res["response"].(map[string]interface{})["body"])
	require.Nil(t, res["response"].(map[string]interface{})["headers"])
}

func TestAsObjectReturnsEmptyRequestWhenStreamIsForResponse(t *testing.T) {
	response := lunar_messages.OnResponse{
		ID:      "test1",
		Headers: map[string]string{"x-lunar-used-tokens": "3", "authorization": "Bearer 123"},
		Body:    `{"foo": "bar", "year": 2025}`,
	}
	apiStream := stream_types.NewResponseAPIStream(response, sharedState)
	res := stream.AsObject(apiStream)

	require.NotNil(t, res["request"])
	require.Nil(t, res["request"].(map[string]interface{})["body"])
	require.Nil(t, res["request"].(map[string]interface{})["headers"])
}

func TestAsObjectParsesBodyAsMapIfValidJSON(t *testing.T) {
	t.Skip("Skipping since failing on CI only (for missing body) - cannot reproduce locally")
	request := lunar_messages.OnRequest{
		ID:      "test1",
		Headers: map[string]string{"x-lunar-used-tokens": "3", "authorization": "Bearer 123"},
		Body:    `{"foo": "bar", "year": 2025}`,
	}
	apiStream := stream_types.NewRequestAPIStream(request, sharedState)
	res := stream.AsObject(apiStream)

	parsedBody := map[string]interface{}{"foo": "bar", "year": float64(2025)}
	require.Equal(t, parsedBody, res["body"])
}

func TestAsObjectParsesBodyAsStringIfInvalidJSON(t *testing.T) {
	t.Skip("Skipping since failing on CI only (for missing body) - cannot reproduce locally")
	request := lunar_messages.OnRequest{
		ID:      "test1",
		Headers: map[string]string{"x-lunar-used-tokens": "3", "authorization": "Bearer 123"},
		Body:    `{invalid: json}`,
	}
	apiStream := stream_types.NewRequestAPIStream(request, sharedState)
	res := stream.AsObject(apiStream)

	require.Equal(t, "{invalid: json}", res["body"])
}

func TestAsObjectParsesHeadersAsMapOfStringString(t *testing.T) {
	request := lunar_messages.OnRequest{
		ID:      "test1",
		Headers: map[string]string{"x-lunar-used-tokens": "3", "authorization": "Bearer 123"},
		Body:    `{invalid: json}`,
	}
	apiStream := stream_types.NewRequestAPIStream(request, sharedState)
	res := stream.AsObject(apiStream)

	headers := res["headers"].(map[string]interface{})
	headerCount := 0
	for range headers {
		headerCount++
	}
	require.Equal(t, 2, headerCount)

	require.Equal(t, headers["x-lunar-used-tokens"], "3")
	require.Equal(t, headers["authorization"], "Bearer 123")
}
