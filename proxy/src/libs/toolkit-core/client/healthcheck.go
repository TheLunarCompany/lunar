package client

import (
	"fmt"
	"lunar/toolkit-core/clock"
	"net/http"

	"github.com/rs/zerolog/log"
)

type HealthcheckConfig struct {
	URL             string
	BodyPredicate   func(bytes []byte) bool
	StatusPredicate func(code int) bool
	HTTPClient      HTTPClient
}

type HTTPClient interface {
	Get(string) (resp *http.Response, err error)
}

func WaitForHealthcheck(
	clock clock.Clock,
	retryConfig *RetryConfig,
	healthcheckConfig *HealthcheckConfig,
) error {
	_, err := WithRetry(
		clock,
		retryConfig,
		func() (interface{}, error) {
			return struct{}{}, singleHealthcheck(healthcheckConfig)
		},
	)

	return err
}

func (config HealthcheckConfig) matchPredicates(response *http.Response) bool {
	var body []byte
	_, err := response.Body.Read(body)
	if err != nil {
		log.Error().
			Err(err).
			Msg("could not read response body, will fail predicate match")
		return false
	}
	return config.BodyPredicate(body) &&
		config.StatusPredicate(response.StatusCode)
}

func singleHealthcheck(healthcheckConfig *HealthcheckConfig) error {
	response, err := healthcheckConfig.HTTPClient.Get(healthcheckConfig.URL)
	if err != nil {
		return err
	}
	if healthcheckConfig.matchPredicates(response) {
		return nil
	}
	return fmt.Errorf("predicates not matched")
}
