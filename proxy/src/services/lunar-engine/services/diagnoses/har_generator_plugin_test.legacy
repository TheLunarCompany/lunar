package diagnoses_test

import (
	"encoding/json"
	"lunar/engine/config"
	"lunar/engine/formats/har"
	lunarMessages "lunar/engine/messages"
	"lunar/engine/services/diagnoses"
	"lunar/engine/utils/obfuscation"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/testutils"
	"testing"
	"time"

	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
)

const obfuscatedValue = "<obfuscated>"

func TestGenerateHARWithoutObfuscation(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	plugin := diagnoses.NewHARGeneratorPlugin(clock, obfuscator)
	tree, err := config.BuildEndpointPolicyTree([]sharedConfig.EndpointConfig{})
	assert.Nil(t, err)
	diagnosisConfig := sharedConfig.HARExporterConfig{
		Obfuscate: sharedConfig.Obfuscate{Enabled: false},
	}
	requestTime := time.Date(2023, 8, 21, 17, 0, 31, 0, time.UTC)
	responseTime := requestTime.Add(time.Second * 6)

	onRequest := lunarMessages.OnRequest{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		Scheme:     "http",
		URL:        "example.com/api/v1/endpoint",
		Path:       "api/v1/endpoint",
		Query:      "param1=value1&param2=value2",
		Headers: map[string]string{
			"content-type": "application/json",
			"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" +
				"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36",
		},
		Body: `{"key": "value"}`,
		Time: requestTime,
	}

	onResponse := lunarMessages.OnResponse{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		URL:        "example.com/api/v1/endpoint",
		Status:     200,
		Headers: map[string]string{
			"content-type": "application/json",
			"date":         clock.Now().Format(time.RFC1123),
			"server":       "nginx",
		},
		Body: `{"message": "Success"}`,
		Time: responseTime,
	}

	// Call GenerateHAR
	harData, err := plugin.GenerateHAR(
		onRequest,
		onResponse,
		tree,
		&diagnosisConfig,
	)
	assert.Nil(t, err)

	// Check if the required fields are filled
	assert.Equal(t, "1.2", harData.Log.Version)
	assert.Equal(t, "Lunar Har Exporter", harData.Log.Creator.Name)
	assert.Equal(t, 200, harData.Log.Entries[0].Response.Status)
	assert.Equal(t, "GET", harData.Log.Entries[0].Request.Method)
	assert.Equal(
		t,
		"http://example.com/api/v1/endpoint",
		harData.Log.Entries[0].Request.URL,
	)

	assert.Equal(t, `{"key": "value"}`, harData.Log.Entries[0].Request.Body)
	assert.Equal(t,
		`{"message": "Success"}`, harData.Log.Entries[0].Response.Content)
	assert.Equal(t, time.Duration(6000000000), harData.Log.Entries[0].Time)
	startedDateTime, _ := json.Marshal(
		harData.Log.Entries[0].StartedDateTime)
	assert.Equal(t, string("\"2023-08-21T17:00:31Z\""), string(startedDateTime))

	requestUserAgent, found := onRequest.Headers["user-agent"]
	assert.True(t, found)
	harUserAgent, found := getHARHeaderValue(
		harData.Log.Entries[0].Request.Headers,
		"user-agent",
	)
	assert.True(t, found)
	assert.Equal(t, requestUserAgent, harUserAgent)

	assert.ElementsMatch(
		t,
		[]har.Query{
			{Name: "param2", Value: []string{"value2"}},
			{Name: "param1", Value: []string{"value1"}},
		},
		harData.Log.Entries[0].Request.QueryString,
	)
}

func TestGenerateHARWithObfuscation(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	plugin := diagnoses.NewHARGeneratorPlugin(clock, obfuscator)
	tree, err := config.BuildEndpointPolicyTree([]sharedConfig.EndpointConfig{})
	assert.Nil(t, err)
	diagnosisConfig := sharedConfig.HARExporterConfig{
		Obfuscate: sharedConfig.Obfuscate{Enabled: true},
	}

	onRequest := lunarMessages.OnRequest{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		Scheme:     "http",
		URL:        "example.com/api/v1/endpoint",
		Path:       "api/v1/endpoint",
		Query:      "param1=value1&param2=value2",
		Headers: map[string]string{
			"content-type": "application/json",
			"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" +
				"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36",
		},
		Body: `{"key": "value"}`,
		Time: time.Now(),
	}

	onResponse := lunarMessages.OnResponse{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		URL:        "example.com/api/v1/endpoint",
		Status:     200,
		Headers: map[string]string{
			"content-type": "application/json",
			"date":         clock.Now().Format(time.RFC1123),
			"server":       "nginx",
		},
		Body: `{"message": "Success"}`,
		Time: time.Now(),
	}

	// Call GenerateHAR
	harData, err := plugin.GenerateHAR(
		onRequest,
		onResponse,
		tree,
		&diagnosisConfig,
	)
	assert.Nil(t, err)

	// Check if the required fields are filled
	assert.Equal(t, "1.2", harData.Log.Version)
	assert.Equal(t, "Lunar Har Exporter", harData.Log.Creator.Name)
	assert.Equal(t, onResponse.Status, harData.Log.Entries[0].Response.Status)
	assert.Equal(t, onRequest.Method, harData.Log.Entries[0].Request.Method)
	assert.Equal(
		t,
		"http://example.com/<obfuscated>/<obfuscated>/<obfuscated>",
		harData.Log.Entries[0].Request.URL,
	)
	assert.Equal(
		t,
		`{"key":"<obfuscated>"}`,
		harData.Log.Entries[0].Request.Body,
	)
	assert.Equal(
		t,
		`{"message":"<obfuscated>"}`,
		harData.Log.Entries[0].Response.Content,
	)

	harUserAgent, found := getHARHeaderValue(
		harData.Log.Entries[0].Request.Headers,
		"user-agent",
	)
	assert.True(t, found)
	assert.Equal(t, "<obfuscated>", harUserAgent)

	assert.ElementsMatch(
		t,
		[]har.Query{
			{Name: "param2", Value: []string{"<obfuscated>"}},
			{Name: "param1", Value: []string{"<obfuscated>"}},
		},
		harData.Log.Entries[0].Request.QueryString,
	)
}

func TestGenerateHARWithObfuscationWithExclusions(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	plugin := diagnoses.NewHARGeneratorPlugin(clock, obfuscator)
	tree, err := config.BuildEndpointPolicyTree([]sharedConfig.EndpointConfig{})
	assert.Nil(t, err)
	diagnosisConfig := sharedConfig.HARExporterConfig{
		Obfuscate: sharedConfig.Obfuscate{
			Enabled: true,
			Exclusions: sharedConfig.ObfuscationExclusions{
				RequestHeaders:    []string{"content-type"},
				ResponseHeaders:   []string{"content-type"},
				QueryParams:       []string{"param2"},
				RequestBodyPaths:  []string{".key_b"},
				ResponseBodyPaths: []string{".message_b"},
			},
		},
	}

	onRequest := lunarMessages.OnRequest{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		Scheme:     "http",
		URL:        "example.com/api/v1/endpoint",
		Path:       "api/v1/endpoint",
		Query:      "param1=value1&param2=value2",
		Headers: map[string]string{
			"content-type": "application/json",
			"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" +
				"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36",
		},
		Body: `{"key_a": "value_a", "key_b": "value_b"}`,
		Time: time.Now(),
	}

	onResponse := lunarMessages.OnResponse{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		URL:        "example.com/api/v1/endpoint",
		Status:     200,
		Headers: map[string]string{
			"content-type": "application/json",
			"date":         clock.Now().Format(time.RFC1123),
			"server":       "nginx",
		},
		Body: `{"message_a": "Success", "message_b": "Another success!"}`,
		Time: time.Now(),
	}

	// Call GenerateHAR
	harData, err := plugin.GenerateHAR(
		onRequest,
		onResponse,
		tree,
		&diagnosisConfig,
	)
	assert.Nil(t, err)

	assert.Equal(
		t,
		`{"key_a":"<obfuscated>","key_b":"value_b"}`,
		harData.Log.Entries[0].Request.Body,
	)
	assert.Equal(
		t,
		`{"message_a":"<obfuscated>","message_b":"Another success!"}`,
		harData.Log.Entries[0].Response.Content,
	)

	harRequestUserAgent, found := getHARHeaderValue(
		harData.Log.Entries[0].Request.Headers,
		"user-agent",
	)
	assert.True(t, found)
	assert.Equal(t, "<obfuscated>", harRequestUserAgent)

	harRequestContentType, found := getHARHeaderValue(
		harData.Log.Entries[0].Request.Headers,
		"content-type",
	)
	assert.True(t, found)
	assert.Equal(t, "application/json", harRequestContentType)

	harResponseDate, found := getHARHeaderValue(
		harData.Log.Entries[0].Response.Headers,
		"date",
	)
	assert.True(t, found)
	assert.Equal(t, "<obfuscated>", harResponseDate)

	harResponseContentType, found := getHARHeaderValue(
		harData.Log.Entries[0].Response.Headers,
		"content-type",
	)
	assert.True(t, found)
	assert.Equal(t, "application/json", harResponseContentType)

	assert.ElementsMatch(
		t,
		[]har.Query{
			{Name: "param2", Value: []string{"value2"}},
			{Name: "param1", Value: []string{"<obfuscated>"}},
		},
		harData.Log.Entries[0].Request.QueryString,
	)
}

func TestGenerateHARWithObfuscationWithKnownPathParts(t *testing.T) {
	t.Parallel()

	harData, err := generateHARForURLTesting(
		[]sharedConfig.EndpointConfig{
			{URL: "twitter.com/users/{userId}/comments"},
		},
		"twitter.com/users/44/comments",
		[]string{},
	)
	assert.Nil(t, err)

	// Check if the required fields are filled
	assert.Equal(
		t,
		"https://twitter.com/users/<obfuscated>/comments",
		harData.Log.Entries[0].Request.URL,
	)
}

func TestGenerateHARWithObfuscationWithKnownPathPartsAndTrailingUnknownParts(
	t *testing.T,
) {
	t.Parallel()

	harData, err := generateHARForURLTesting(
		[]sharedConfig.EndpointConfig{
			{URL: "twitter.com/users/{userId}/comments/*"},
		},
		"twitter.com/users/44/comments/123",
		[]string{},
	)
	assert.Nil(t, err)

	// Check if the required fields are filled
	assert.Equal(
		t,
		"https://twitter.com/users/<obfuscated>/comments/<obfuscated>",
		harData.Log.Entries[0].Request.URL,
	)
}

func TestGenerateHARWithObfuscationWithKnownPathPartsAndExclusions(
	t *testing.T,
) {
	t.Parallel()

	harData, err := generateHARForURLTesting(
		[]sharedConfig.EndpointConfig{
			{URL: "twitter.com/users/{userId}/sensitiveData/{sensitiveData}"},
		},
		"twitter.com/users/44/sensitiveData/monSecret",
		[]string{"userId"},
	)
	assert.Nil(t, err)

	// Check if the required fields are filled
	assert.Equal(
		t,
		"https://twitter.com/users/44/sensitiveData/<obfuscated>",
		harData.Log.Entries[0].Request.URL,
	)
}

func TestGenerateHARWithObfuscationDisabledAndExcludedFieldsDefinedDoesNothing(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{Value: obfuscatedValue},
	}
	plugin := diagnoses.NewHARGeneratorPlugin(clock, obfuscator)
	tree, err := config.BuildEndpointPolicyTree(
		[]sharedConfig.EndpointConfig{},
	)
	assert.Nil(t, err)
	// note how `enabled` is set to false even though
	// exclusions are declared
	diagnosisConfig := sharedConfig.HARExporterConfig{
		Obfuscate: sharedConfig.Obfuscate{
			Enabled: false,
			Exclusions: sharedConfig.ObfuscationExclusions{
				RequestBodyPaths:  []string{"key"},
				ResponseBodyPaths: []string{"message"},
			},
		},
	}

	onRequest := lunarMessages.OnRequest{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		Scheme:     "http",
		URL:        "example.com/api/v1/endpoint",
		Path:       "api/v1/endpoint",
		Query:      "param1=value1&param2=value2",
		Headers: map[string]string{
			"content-type": "application/json",
			"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" +
				"AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.101 Safari/537.36",
		},
		Body: `{"key": "value"}`,
		Time: time.Now(),
	}

	onResponse := lunarMessages.OnResponse{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		URL:        "example.com/api/v1/endpoint",
		Status:     200,
		Headers: map[string]string{
			"content-type": "application/json",
			"date":         clock.Now().Format(time.RFC1123),
			"server":       "nginx",
		},
		Body: `{"message": "Success"}`,
		Time: time.Now(),
	}

	// Call GenerateHAR
	harData, err := plugin.GenerateHAR(
		onRequest,
		onResponse,
		tree,
		&diagnosisConfig,
	)
	assert.Nil(t, err)

	// both fields are not obfuscated, even though they were specified in
	// exclusion lists - since `enabled` is set to `false`
	assert.Equal(t, `{"key": "value"}`, harData.Log.Entries[0].Request.Body)
	assert.Equal(
		t, `{"message": "Success"}`, harData.Log.Entries[0].Response.Content)
}

func TestItDecompressGzipIfResponseContentEncodingHeaderIsExactlyGzip(
	t *testing.T,
) {
	t.Parallel()

	rawResponseBody := `{"message": "Success"}`
	harData, err := generateHARForDecompressionTesting(
		decompressionTestingInput{},
		decompressionTestingInput{
			configHeaderNames: sharedConfig.HeaderNames{
				ContentEncoding: "contentencoding",
			},
			headers: map[string]string{"contentencoding": "gzip"},
			body:    testutils.CompressGZip(rawResponseBody),
		},
	)
	assert.Nil(t, err)

	entry := harData.Log.Entries[0]
	assert.Equal(t, rawResponseBody, entry.Response.Content)
}

func TestItDoesntDecompressGzipIfResponseContentEncodingHeaderContainsGzipAndOthers(
	t *testing.T,
) {
	t.Parallel()

	rawResponseBody := `{"message": "Success"}`
	compressedResponseBody := testutils.CompressGZip(rawResponseBody)
	harData, err := generateHARForDecompressionTesting(
		decompressionTestingInput{},
		decompressionTestingInput{
			configHeaderNames: sharedConfig.HeaderNames{
				ContentEncoding: "contentencoding",
			},
			headers: map[string]string{"contentencoding": "gzip, deflate"},
			body:    compressedResponseBody,
		},
	)
	assert.Nil(t, err)

	entry := harData.Log.Entries[0]
	assert.Equal(t, compressedResponseBody, entry.Response.Content)
}

func TestItDecompressesGzipIfResponseContentEncodingHeaderIsExactlyGzipEvenWithoutHeaderNameConfigured(
	t *testing.T,
) {
	t.Parallel()

	rawResponseBody := `{"message": "Success"}`
	harData, err := generateHARForDecompressionTesting(
		decompressionTestingInput{},
		decompressionTestingInput{
			// `Content-Encoding` is the conventional name for this header
			headers: map[string]string{"content-encoding": "gzip"},
			body:    testutils.CompressGZip(rawResponseBody),
		},
	)
	assert.Nil(t, err)

	entry := harData.Log.Entries[0]
	assert.Equal(t, rawResponseBody, entry.Response.Content)
}

func generateHARForURLTesting(
	knownEndpoints []sharedConfig.EndpointConfig,
	requestURL string,
	excludedPathParams []string,
) (*har.HAR, error) {
	clock := clock.NewMockClock()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{
			Value: obfuscatedValue,
		},
	}
	plugin := diagnoses.NewHARGeneratorPlugin(clock, obfuscator)
	tree, _ := config.BuildEndpointPolicyTree(knownEndpoints)
	diagnosisConfig := sharedConfig.HARExporterConfig{
		Obfuscate: sharedConfig.Obfuscate{
			Enabled: true,
			Exclusions: sharedConfig.ObfuscationExclusions{
				PathParams: excludedPathParams,
			},
		},
	}

	onRequest := lunarMessages.OnRequest{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		Scheme:     "https",
		URL:        requestURL,
		Path:       "users/44/comments",
		Query:      "",
		Headers:    map[string]string{},
		Body:       `{"key": "value"}`,
		Time:       time.Now(),
	}

	onResponse := lunarMessages.OnResponse{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		URL:        requestURL,
		Status:     200,
		Headers: map[string]string{
			"content-type": "application/json",
			"date":         clock.Now().Format(time.RFC1123),
			"server":       "nginx",
		},
		Body: `{"message": "Success"}`,
		Time: time.Now(),
	}

	return plugin.GenerateHAR(
		onRequest,
		onResponse,
		tree,
		&diagnosisConfig,
	)
}

type decompressionTestingInput struct {
	configHeaderNames sharedConfig.HeaderNames
	headers           map[string]string
	body              string
}

func generateHARForDecompressionTesting(
	request decompressionTestingInput,
	response decompressionTestingInput,
) (*har.HAR, error) {
	clock := clock.NewMockClock()
	obfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.FixedHasher{
			Value: obfuscatedValue,
		},
	}
	plugin := diagnoses.NewHARGeneratorPlugin(clock, obfuscator)
	tree, _ := config.BuildEndpointPolicyTree([]sharedConfig.EndpointConfig{})
	diagnosisConfig := sharedConfig.HARExporterConfig{
		RequestHeaderNames:  request.configHeaderNames,
		ResponseHeaderNames: response.configHeaderNames,
	}

	onRequest := lunarMessages.OnRequest{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		Scheme:     "https",
		URL:        "example.com/api/v1/endpoint",
		Path:       "api/v1/endpoint",
		Query:      "",
		Headers:    request.headers,
		Body:       request.body,
		Time:       time.Now(),
	}

	onResponse := lunarMessages.OnResponse{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		URL:        "example.com/api/v1/endpoint",
		Status:     200,
		Headers:    response.headers,
		Body:       response.body,
		Time:       time.Now(),
	}

	return plugin.GenerateHAR(
		onRequest,
		onResponse,
		tree,
		&diagnosisConfig,
	)
}

func getHARHeaderValue(
	harHeaders []har.Header,
	headerName string,
) (string, bool) {
	harHeader, found := lo.Find(harHeaders, func(item har.Header) bool {
		return item.Name == headerName
	})
	if !found {
		return "", false
	}
	return harHeader.Value, true
}
