package diagnoses_test

import (
	"lunar/engine/config"
	"lunar/engine/messages"
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
	policy := buildMetricsCollectorPolicy(utils.ScopeGlobal)
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
	policy := buildMetricsCollectorPolicy(utils.ScopeGlobal)
	res, err := plugin.OnTransaction(onRequest, onResponse, tree, &policy)
	assert.Nil(t, err)
	assert.Equal(t, "example.com", res.Metrics.NormalizedURL)
}

func TestItReturnsDiagnosisNormalizedURLAsNormalizedURLWhenPluginIsInScopeEndpoint( //nolint:lll
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
	policy := buildMetricsCollectorPolicy(utils.ScopeEndpoint)
	res, err := plugin.OnTransaction(onRequest, onResponse, tree, &policy)
	assert.Nil(t, err)
	assert.Equal(
		t,
		validRequestURL,
		res.Metrics.NormalizedURL,
	)
}

func TestItReturnsNAAsNormalizedURLWhenPluginIsInScopeGlobalAndRequestURLIsInvalid( //nolint:lll
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
	policy := buildMetricsCollectorPolicy(utils.ScopeGlobal)
	res, err := plugin.OnTransaction(onRequest, onResponse, tree, &policy)
	assert.Nil(t, err)
	assert.Equal(t, "N/A", res.Metrics.NormalizedURL)
}

func buildOnRequest(requestTime time.Time, url string) messages.OnRequest {
	return messages.OnRequest{
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

func buildOnResponse(responseTime time.Time) messages.OnResponse {
	return messages.OnResponse{
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

func buildMetricsCollectorPolicy(scope utils.Scope) config.ScopedDiagnosis {
	return config.ScopedDiagnosis{
		Scope:         scope,
		Method:        "GET",
		NormalizedURL: validRequestURL,
		Diagnosis: &sharedConfig.Diagnosis{
			Enabled: true,
			Name:    "test",
			Config: sharedConfig.DiagnosisConfig{
				MetricsCollector: &sharedConfig.MetricsCollectorConfig{},
			},
			Export: "prometheus",
		},
	}
}
