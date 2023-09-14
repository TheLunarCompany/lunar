package config

import (
	"fmt"
	"lunar/engine/utils/environment"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/client"
	"lunar/toolkit-core/clock"
	"net/http"
	"regexp"
	"strings"

	"github.com/rs/zerolog/log"
)

const (
	// Regex for replacing path parameters in URL, e.g.:
	// ^twitter\.com\/user/[^/]+$
	// See unit tests for matching/non-matching URL examples:
	// https://regex101.com/r/DyYNZD/1
	RegexToReplacePathParameters string = "/[^/]+"

	// Regex for replacing wildcard in URL, e.g.:
	// ^twitter\.com\/user(/.*)?$
	// See unit tests for matching/non-matching URL examples:
	// https://regex101.com/r/XVN7Kw/1
	RegexToReplaceWildcard string = "(/.*)?"

	// Example of regex for a URL with both path parameters and wildcard:
	// ^twitter\.com\/user/[^/]+/post/[^/]+/by(/.*)?$
	// See unit tests for matching/non-matching URL examples:
	// https://regex101.com/r/3bKePx/1
)

const (
	delimiter                        string = ":::"
	initialTimeToWaitInSec           int    = 0
	timesToRetry                     int    = 40
	timeToWaitBetweenRetriesInMillis int    = 250
)

var (
	haproxyManagePort         = environment.GetManageEndpointsPort()
	healthcheckPort           = environment.GetHAProxyHealthcheckPort()
	healthcheckURL            = "http://localhost:" + healthcheckPort + "/healthcheck?proxy_only=true" //nolint: lll
	haproxyManagedEndpointURL = "http://localhost:" + haproxyManagePort + "/managed_endpoint"          //nolint: lll
	haproxyManageAllURL       = "http://localhost:" + haproxyManagePort + "/manage_all"                //nolint: lll
)

var regexToFindPathParameters = regexp.MustCompile(`/\{[a-zA-Z0-9-_]+\}`)

type HAProxyEndpointsRequest struct {
	ManageAll        bool
	ManagedEndpoints []string
}

func BuildHAProxyEndpointsRequest(
	policies *sharedConfig.PoliciesConfig,
) *HAProxyEndpointsRequest {
	manageAll := false
	for _, global := range policies.Global.Diagnosis {
		if global.Enabled {
			manageAll = true
			break
		}
	}
	if !manageAll {
		for _, global := range policies.Global.Remedies {
			if global.Enabled {
				manageAll = true
				break
			}
		}
	}
	managedEndpoints := []string{}
	for _, endpoint := range policies.Endpoints {
		for _, remedy := range endpoint.Remedies {
			if remedy.Enabled {
				managedEndpoints = append(managedEndpoints,
					haproxyEndpointFormat(endpoint.Method, endpoint.URL))
			}
		}
		for _, diagnosis := range endpoint.Diagnosis {
			if diagnosis.Enabled {
				managedEndpoints = append(managedEndpoints,
					haproxyEndpointFormat(endpoint.Method, endpoint.URL))
			}
		}
	}
	return &HAProxyEndpointsRequest{
		ManageAll:        manageAll,
		ManagedEndpoints: managedEndpoints,
	}
}

func manageHAProxyEndpoints(haproxyEndpoints *HAProxyEndpointsRequest) error {
	err := updateHAProxyEndpoints(haproxyEndpoints)
	if err != nil {
		return err
	}
	log.Info().Msg("✍️  Successfully updated HAProxy endpoints")
	return nil
}

func unmanageHAProxyEndpoints(unmanagedEndpoints []string) error {
	for _, unmanagedEndpoint := range unmanagedEndpoints {
		err := operateEndpoint(unmanagedEndpoint, http.MethodDelete)
		if err != nil {
			return fmt.Errorf("Failed to unmanage endpoint '%v', error: %v",
				unmanagedEndpoint, err)
		}
	}

	log.Info().Msg("✍️  Successfully unmanaged HAProxy endpoints")
	return nil
}

func updateHAProxyEndpoints(haproxyEndpoints *HAProxyEndpointsRequest) error {
	if haproxyEndpoints.ManageAll {
		return manageAll()
	}

	for _, managedEndpoint := range haproxyEndpoints.ManagedEndpoints {
		err := operateEndpoint(managedEndpoint, http.MethodPut)
		if err != nil {
			return fmt.Errorf("Failed to manage endpoint '%v', error: %v",
				managedEndpoint, err)
		}
	}

	return nil
}

func operateEndpoint(endpoint string, method string) error {
	body := strings.NewReader(endpoint)
	request, err := http.NewRequest(method, haproxyManagedEndpointURL, body)
	if err != nil {
		return err
	}

	log.Debug().Msgf("Sending request to %s endpoint %s at URL %v",
		method, endpoint, request.URL.String())
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return err
	}
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("Failed to %s endpoint %v, status: %v",
			method, endpoint, response.StatusCode)
	}
	return nil
}

func manageAll() error {
	request, err := http.NewRequest(http.MethodPut, haproxyManageAllURL, nil)
	if err != nil {
		return err
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return err
	}
	if response.StatusCode != http.StatusOK {
		buffer := make([]byte, 1024)
		_, err := response.Body.Read(buffer)
		defer response.Body.Close()
		if err != nil {
			return fmt.Errorf(
				"Failed to manage all, status: %v",
				response.StatusCode,
			)
		}
		return fmt.Errorf("Failed to manage all, status: %v, body: %v",
			response.StatusCode, string(buffer))
	}
	return nil
}

func haproxyEndpointFormat(method string, url string) string {
	log.Debug().Msgf("Original URL: %v", url)
	url = strings.ReplaceAll(url, ".", `\.`)
	formattedURL := url
	wildcardLiteral := "/*"
	var hasWildcard bool
	if strings.HasSuffix(formattedURL, wildcardLiteral) {
		hasWildcard = true
		formattedURL = strings.TrimSuffix(formattedURL, wildcardLiteral)
		formattedURL += RegexToReplaceWildcard
	}
	formattedURL = regexToFindPathParameters.ReplaceAllString(
		formattedURL,
		RegexToReplacePathParameters,
	)
	log.Debug().Msgf("Formatted URL: %v", formattedURL)
	result := strings.Join([]string{method, formattedURL}, delimiter)
	if !hasWildcard {
		result += "$"
	}
	return result
}

func waitForHealthcheck(clock clock.Clock) error {
	retryConfig := client.RetryConfig{
		Attempts:           timesToRetry,
		SleepMillis:        timeToWaitBetweenRetriesInMillis,
		WithInitialSleep:   false,
		InitialSleepMillis: initialTimeToWaitInSec,
		FailedAttemptLog:   "Failed attempt to update HAProxy endpoints",
		FailureLog:         "Failed to update HAProxy endpoints",
	}
	healthcheckConfig := client.HealthcheckConfig{
		URL:             healthcheckURL,
		BodyPredicate:   func(_ []byte) bool { return true },
		StatusPredicate: func(code int) bool { return code == 200 },
		HTTPClient:      http.DefaultClient,
	}
	return client.WaitForHealthcheck(clock, &retryConfig, &healthcheckConfig)
}
