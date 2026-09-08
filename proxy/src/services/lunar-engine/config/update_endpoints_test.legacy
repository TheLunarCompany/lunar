package config_test

import (
	"lunar/engine/config"
	sharedConfig "lunar/shared-model/config"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGivenExactURLGetHAProxyPoliciesReturnsExactURL(t *testing.T) {
	testMethod := "GET"
	testURL := "twitter.com/user/1234"
	policies := policiesConfig(testURL, testMethod)

	haproxyPolicies := config.BuildHAProxyEndpointsRequest(policies)

	wantEndpoint := testMethod +
		":::" +
		strings.ReplaceAll(testURL, ".", `\.`) +
		"$"
	assert.False(t, haproxyPolicies.ManageAll)

	assert.Equal(t, []string{wantEndpoint}, extractURLs(haproxyPolicies))
}

func TestGivenParametricURLGetHAProxyPoliciesReturnsURLWithPathParamRegex(
	t *testing.T,
) {
	wantMethod := "GET"
	urlPrefix := "twitter.com/user"
	parametricURL := urlPrefix + "/{userID}"
	policies := policiesConfig(parametricURL, wantMethod)

	haproxyPolicies := config.BuildHAProxyEndpointsRequest(policies)

	wantEndpoint := wantMethod +
		":::" +
		strings.ReplaceAll(urlPrefix, ".", `\.`) +
		config.RegexToReplacePathParameters + "$"
	assert.False(t, haproxyPolicies.ManageAll)
	assert.Equal(t, []string{wantEndpoint}, extractURLs(haproxyPolicies))
}

func TestGivenURLWithWildcardGetHAProxyPoliciesReturnsURLWithWildcardRegex(
	t *testing.T,
) {
	wantMethod := "GET"
	urlPrefix := "twitter.com/user"
	wildcardURL := urlPrefix + "/*"
	policies := policiesConfig(wildcardURL, wantMethod)

	haproxyPolicies := config.BuildHAProxyEndpointsRequest(policies)

	wantEndpoint := wantMethod + ":::" +
		strings.ReplaceAll(urlPrefix, ".", `\.`) + config.RegexToReplaceWildcard
	assert.False(t, haproxyPolicies.ManageAll)
	assert.Equal(t, []string{wantEndpoint}, extractURLs(haproxyPolicies))
}

func TestGivenURLWithWildcardAndPathParameterGetHAProxyPoliciesReturnsURLWithWildcardAndPathParameterRegexes( //
	t *testing.T,
) {
	wantMethod := "GET"
	urlPrefix := "twitter.com/user"
	finalURL := urlPrefix + "/{userID}" + "/messages" + "/*"
	policies := policiesConfig(finalURL, wantMethod)

	haproxyPolicies := config.BuildHAProxyEndpointsRequest(policies)

	wantURL := strings.ReplaceAll(urlPrefix, ".", `\.`) +
		config.RegexToReplacePathParameters +
		"/messages" +
		config.RegexToReplaceWildcard

	wantEndpoint := wantMethod + ":::" + wantURL
	assert.False(t, haproxyPolicies.ManageAll)
	assert.Equal(t, []string{wantEndpoint}, extractURLs(haproxyPolicies))
}

func policiesConfig(
	wantURL string,
	wantMethod string,
) *sharedConfig.PoliciesConfig {
	policies := &sharedConfig.PoliciesConfig{
		Global: sharedConfig.Global{},
		Endpoints: []sharedConfig.EndpointConfig{
			{
				URL:    wantURL,
				Method: wantMethod,
				Remedies: []sharedConfig.Remedy{
					{
						Enabled: true,
						Name:    "FixedResponse",
						Config: sharedConfig.RemedyConfig{
							FixedResponse: &sharedConfig.FixedResponseConfig{
								StatusCode: http.StatusTeapot,
							},
						},
					},
				},
			},
		},
	}
	return policies
}

func extractURLs(data *config.HAProxyEndpointsRequest) []string {
	result := []string{}
	for _, endpoint := range data.ManagedEndpoints {
		result = append(result, endpoint.Endpoint)
	}
	return result
}
