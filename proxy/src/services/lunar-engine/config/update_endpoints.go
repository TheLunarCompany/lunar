package config

import (
	"fmt"
	"lunar/engine/utils/environment"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/client"
	contextmanager "lunar/toolkit-core/context-manager"
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
	healthcheckURL            = "http://localhost:" + healthcheckPort + "/healthcheck?proxy_only=true"
	haproxyManagedEndpointURL = "http://localhost:" + haproxyManagePort + "/managed_endpoint"
	haproxyManageAllURL       = "http://localhost:" + haproxyManagePort + "/manage_all"
	haproxyUnManageAllURL     = "http://localhost:" + haproxyManagePort + "/unmanage_all"
	haproxyUnmanageGlobalURL  = "http://localhost:" + haproxyManagePort + "/unmanage_global"
	haproxyBodyNeededFrom     = "http://localhost:" + haproxyManagePort + "/include_body_from"
	haproxyBodyFormAll        = "http://localhost:" + haproxyManagePort + "/include_body_from_all"
)

var regexToFindPathParameters = regexp.MustCompile(`/\{[a-zA-Z0-9-_]+\}`)

type HAProxyEndpointData struct {
	Endpoint   string
	BodyNeeded bool
}

type HAProxyEndpointsRequest struct {
	ManageAll        bool
	BodyNeededForAll bool
	ManagedEndpoints []*HAProxyEndpointData
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
	managedEndpoints := []*HAProxyEndpointData{}
	for _, endpoint := range policies.Endpoints {
		for _, remedy := range endpoint.Remedies {
			if remedy.Enabled {
				managedEndpoints = append(managedEndpoints,
					HaproxyEndpointFormat(endpoint.Method, endpoint.URL, true))
			}
		}
		for _, diagnosis := range endpoint.Diagnosis {
			if diagnosis.Enabled {
				managedEndpoints = append(managedEndpoints,
					HaproxyEndpointFormat(endpoint.Method, endpoint.URL, true))
			}
		}
	}
	return &HAProxyEndpointsRequest{
		ManageAll:        manageAll,
		BodyNeededForAll: true,
		ManagedEndpoints: managedEndpoints,
	}
}

func WaitForProxyHealthcheck() error {
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
	clock := contextmanager.Get().GetClock()
	return client.WaitForHealthcheck(clock, &retryConfig, &healthcheckConfig)
}

func HaproxyEndpointFormat(method, url string, bodyNeededInMessage bool) *HAProxyEndpointData {
	log.Trace().Msgf("Original URL: %v", url)
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
	log.Trace().Msgf("Formatted URL: %v", formattedURL)
	result := strings.Join([]string{method, formattedURL}, delimiter)
	if !hasWildcard {
		result += "$"
	}
	return &HAProxyEndpointData{
		Endpoint:   result,
		BodyNeeded: bodyNeededInMessage,
	}
}

func ManageHAProxyEndpoints(haproxyEndpoints *HAProxyEndpointsRequest) error {
	err := updateHAProxyEndpoints(haproxyEndpoints)
	if err != nil {
		return err
	}
	log.Debug().Msg("✍️  Successfully updated endpoints")
	return nil
}

func unmanageHAProxyEndpoints(unmanagedEndpoints []*HAProxyEndpointData) error {
	for _, unmanagedEndpoint := range unmanagedEndpoints {
		err := operateEndpoint(unmanagedEndpoint.Endpoint, http.MethodDelete, haproxyManagedEndpointURL)
		if err != nil {
			return fmt.Errorf("failed to unmanage endpoint '%v', error: %v",
				unmanagedEndpoint, err)
		}

		err = operateEndpoint(unmanagedEndpoint.Endpoint, http.MethodDelete, haproxyBodyNeededFrom)
		if err != nil {
			return fmt.Errorf("failed to remove body from message for endpoint '%v', error: %v",
				unmanagedEndpoint, err)
		}

	}

	log.Debug().Msg("✍️  Successfully unmanaged endpoints")
	return nil
}

func updateHAProxyEndpoints(haproxyEndpoints *HAProxyEndpointsRequest) error {
	if haproxyEndpoints.BodyNeededForAll {
		if err := bodyFromAll(); err != nil {
			log.Warn().Err(err).Msg("Failed to include body in message for all endpoints")
		}
	}

	if haproxyEndpoints.ManageAll {
		return manageAll()
	}

	for _, managedEndpoint := range haproxyEndpoints.ManagedEndpoints {
		err := operateEndpoint(managedEndpoint.Endpoint, http.MethodPut, haproxyManagedEndpointURL)
		if err != nil {
			return fmt.Errorf("failed to manage endpoint '%v', error: %v",
				managedEndpoint, err)
		}

		if !managedEndpoint.BodyNeeded {
			continue
		}

		err = operateEndpoint(managedEndpoint.Endpoint, http.MethodPut, haproxyBodyNeededFrom)
		if err != nil {
			return fmt.Errorf("failed to include body in message for endpoint '%v', error: %v",
				managedEndpoint, err)
		}
	}
	return nil
}

func operateEndpoint(endpoint, method, path string) error {
	body := strings.NewReader(endpoint)
	request, err := http.NewRequest(method, path, body)
	if err != nil {
		return err
	}
	log.Trace().Msgf("Sending request to %s endpoint %s at URL %v",
		method, endpoint, request.URL.String())
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return err
	}
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to %s endpoint %v, status: %v",
			method, endpoint, response.StatusCode)
	}
	return nil
}

func bodyFromAll() error {
	return applyAllRequest(http.MethodPut, haproxyBodyFormAll)
}

func manageAll() error {
	return applyAllRequest(http.MethodPut, haproxyManageAllURL)
}

func UnmanageAll() error {
	return applyAllRequest(http.MethodPut, haproxyUnManageAllURL)
}

func unmanageGlobal() error {
	return applyAllRequest(http.MethodDelete, haproxyUnmanageGlobalURL)
}

func applyAllRequest(method, path string) error {
	log.Info().Msgf("Sending request to %s all endpoints at URL %s", method, path)
	request, err := http.NewRequest(method, path, nil)
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
				"failed to manage all, status: %v",
				response.StatusCode,
			)
		}
		return fmt.Errorf("failed to manage all, status: %v, body: %v",
			response.StatusCode, string(buffer))
	}
	return nil
}
