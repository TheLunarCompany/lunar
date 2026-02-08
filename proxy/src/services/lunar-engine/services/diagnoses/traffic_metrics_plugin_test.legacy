package diagnoses_test

import (
	"lunar/engine/config"
	lunarMessages "lunar/engine/messages"
	"lunar/engine/services/diagnoses"
	"lunar/engine/utils"
	sharedConfig "lunar/shared-model/config"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

const validRequestURL = "example.com/api/v1/endpoint"

func TestItReturnsRequestMethodResponseStatusAndTransactionDuration(
	t *testing.T,
) {
	t.Parallel()
	plugin := diagnoses.MetricsCollectorPlugin{}
	requestTime := time.Now()
	responseTime := requestTime.Add(time.Millisecond * 488)
	onRequest := buildOnRequest(requestTime, validRequestURL)
	onResponse := buildOnResponse(responseTime)
	tree, err := config.BuildEndpointPolicyTree([]sharedConfig.EndpointConfig{})
	assert.Nil(t, err)
	policy := buildMetricsCollectorPolicy(utils.ScopeGlobal, false)
	res, err := plugin.OnTransaction(onRequest, onResponse, tree, &policy)
	assert.Nil(t, err)
	assert.Equal(t, "GET", res.Metrics.Method)
	assert.Equal(t, 202, res.Metrics.StatusCode)
	assert.Equal(t, int64(488), res.Metrics.DurationMillis)
}

func TestItReturnsRequestHostAsNormalizedURLWhenPluginIsInScopeGlobal(
	t *testing.T,
) {
	t.Parallel()
	plugin := diagnoses.MetricsCollectorPlugin{}
	requestTime := time.Now()
	responseTime := requestTime.Add(time.Millisecond * 601)
	onRequest := buildOnRequest(requestTime, validRequestURL)
	onResponse := buildOnResponse(responseTime)
	tree, err := config.BuildEndpointPolicyTree([]sharedConfig.EndpointConfig{})
	assert.Nil(t, err)
	policy := buildMetricsCollectorPolicy(utils.ScopeGlobal, false)
	res, err := plugin.OnTransaction(onRequest, onResponse, tree, &policy)
	assert.Nil(t, err)
	assert.Equal(t, "example.com", res.Metrics.NormalizedURL)
}

func TestItReturnsDiagnosisNormalizedURLAsNormalizedURLWhenPluginIsInScopeEndpoint(
	t *testing.T,
) {
	t.Parallel()
	plugin := diagnoses.MetricsCollectorPlugin{}
	requestTime := time.Now()
	responseTime := requestTime.Add(time.Millisecond * 257)
	onRequest := buildOnRequest(requestTime, validRequestURL)
	onResponse := buildOnResponse(responseTime)
	tree, err := config.BuildEndpointPolicyTree([]sharedConfig.EndpointConfig{})
	assert.Nil(t, err)
	policy := buildMetricsCollectorPolicy(utils.ScopeEndpoint, false)
	res, err := plugin.OnTransaction(onRequest, onResponse, tree, &policy)
	assert.Nil(t, err)
	assert.Equal(
		t,
		validRequestURL,
		res.Metrics.NormalizedURL,
	)
}

func TestItReturnsNAAsNormalizedURLWhenPluginIsInScopeGlobalAndRequestURLIsInvalid(
	t *testing.T,
) {
	t.Parallel()
	plugin := diagnoses.MetricsCollectorPlugin{}
	requestTime := time.Now()
	responseTime := requestTime.Add(time.Millisecond * 987)
	onRequest := buildOnRequest(requestTime, "invalid Url_8")
	onResponse := buildOnResponse(responseTime)
	tree, err := config.BuildEndpointPolicyTree([]sharedConfig.EndpointConfig{})
	assert.Nil(t, err)
	policy := buildMetricsCollectorPolicy(utils.ScopeGlobal, false)
	res, err := plugin.OnTransaction(onRequest, onResponse, tree, &policy)
	assert.Nil(t, err)
	assert.Equal(t, "N/A", res.Metrics.NormalizedURL)
}

func TestItReturnsUserDefinedCounterOnResponseHeaderValue(
	t *testing.T,
) {
	t.Parallel()
	plugin := diagnoses.MetricsCollectorPlugin{}
	requestTime := time.Now()
	responseTime := requestTime.Add(time.Millisecond * 500)
	onRequest := buildOnRequest(requestTime, validRequestURL)
	onResponse := buildOnResponse(responseTime)
	onResponse.Headers["Retry-After"] = "4"
	tree, err := config.BuildEndpointPolicyTree([]sharedConfig.EndpointConfig{})
	assert.Nil(t, err)
	policy := buildMetricsCollectorPolicy(utils.ScopeGlobal, true)
	res, err := plugin.OnTransaction(onRequest, onResponse, tree, &policy)
	assert.Nil(t, err)
	assert.Len(t, res.Metrics.Counters, 1)
	assert.Equal(
		t,
		"lunar_response_headers_retry-after",
		res.Metrics.Counters[0].Name,
	)
	assert.Equal(t, int64(4), res.Metrics.Counters[0].Increment)
}

func TestItReturnsNoUserDefinedCounterOnResponseHeaderValueWhichIsNotIntParsable( //
	t *testing.T,
) {
	t.Parallel()
	plugin := diagnoses.MetricsCollectorPlugin{}
	requestTime := time.Now()
	responseTime := requestTime.Add(time.Millisecond * 500)
	onRequest := buildOnRequest(requestTime, validRequestURL)
	onResponse := buildOnResponse(responseTime)
	onResponse.Headers["Retry-After"] = "I belong to no counter!"
	tree, err := config.BuildEndpointPolicyTree([]sharedConfig.EndpointConfig{})
	assert.Nil(t, err)
	policy := buildMetricsCollectorPolicy(utils.ScopeGlobal, true)
	res, err := plugin.OnTransaction(onRequest, onResponse, tree, &policy)
	assert.Nil(t, err)
	assert.Empty(t, res.Metrics.Counters)
}

func TestItReturnsNoUserDefinedCounterOnResponseHeaderValueWhenHeaderIsNotFound( //
	t *testing.T,
) {
	t.Parallel()
	plugin := diagnoses.MetricsCollectorPlugin{}
	requestTime := time.Now()
	responseTime := requestTime.Add(time.Millisecond * 500)
	onRequest := buildOnRequest(requestTime, validRequestURL)
	onResponse := buildOnResponse(responseTime)
	// Remember that we are configured to extract "Retry-After"
	onResponse.Headers["Another-Header"] = "10"
	tree, err := config.BuildEndpointPolicyTree([]sharedConfig.EndpointConfig{})
	assert.Nil(t, err)
	policy := buildMetricsCollectorPolicy(utils.ScopeGlobal, true)
	res, err := plugin.OnTransaction(onRequest, onResponse, tree, &policy)
	assert.Nil(t, err)
	assert.Empty(t, res.Metrics.Counters)
}

func buildOnRequest(requestTime time.Time, url string) lunarMessages.OnRequest {
	return lunarMessages.OnRequest{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		Scheme:     "http",
		URL:        url,
		Path:       "api/v1/endpoint",
		Query:      "param1=value1&param2=value2",
		Headers:    map[string]string{},
		Body:       `{"key": "value"}`,
		Time:       requestTime,
	}
}

func buildOnResponse(responseTime time.Time) lunarMessages.OnResponse {
	return lunarMessages.OnResponse{
		ID:         "test-1",
		SequenceID: "1",
		Method:     "GET",
		URL:        validRequestURL,
		Status:     202,
		Headers:    map[string]string{},
		Body:       ``,
		Time:       responseTime,
	}
}

func buildMetricsCollectorPolicy(
	scope utils.Scope,
	withCounters bool,
) config.ScopedDiagnosis {
	counters := []sharedConfig.Counter{}
	if withCounters {
		counter := sharedConfig.Counter{
			NameSuffix: "retry-after",
			Payload:    "response_headers",
			Key:        "Retry-After",
		}
		counters = append(counters, counter)
	}
	return config.ScopedDiagnosis{
		Scope:         scope,
		Method:        "GET",
		NormalizedURL: validRequestURL,
		Diagnosis: &sharedConfig.Diagnosis{
			Enabled: true,
			Name:    "test",
			Config: sharedConfig.DiagnosisConfig{
				MetricsCollector: &sharedConfig.MetricsCollectorConfig{
					Counters: counters,
				},
			},
			Export: "prometheus",
		},
	}
}
