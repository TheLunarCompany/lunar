package client_test

import (
	"bytes"
	"fmt"
	"io"
	"lunar/toolkit-core/client"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/testutils"
	"net/http"
	"testing"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/stretchr/testify/assert"
)

type MockHTTPClient struct {
	counter      int
	failureAfter int
	okAfter      int
}

var emptyBody = io.NopCloser(bytes.NewBufferString("{}"))

func (mockHTTPClient *MockHTTPClient) Get(_ string) (*http.Response, error) {
	mockHTTPClient.counter++
	log.Info().Msgf("counter: %d", mockHTTPClient.counter)
	if mockHTTPClient.counter > mockHTTPClient.okAfter {
		return &http.Response{
			StatusCode: http.StatusOK,
			Body:       emptyBody,
		}, nil
	}
	if mockHTTPClient.counter > mockHTTPClient.failureAfter {
		return &http.Response{
			StatusCode: http.StatusBadRequest,
			Body:       emptyBody,
		}, nil
	}
	return nil, fmt.Errorf("ugh")
}

func TestHealthcheckReturnsNoErrorWhenPredicatesPass(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	retryConfig := client.RetryConfig{
		Attempts:    5,
		SleepMillis: 50,
	}
	httpClient := MockHTTPClient{
		failureAfter: 1,
		okAfter:      3,
	}

	healthcheckConfig := client.HealthcheckConfig{
		URL:             "mock/healthcheck",
		BodyPredicate:   func(bytes []byte) bool { return true },
		StatusPredicate: func(code int) bool { return code == 200 },
		HTTPClient:      &httpClient,
	}

	testutils.AdvanceTimeInBackground(
		clock,
		retryConfig.Attempts+1,
		time.Duration(retryConfig.SleepMillis+1)*time.Millisecond,
	)

	err := client.WaitForHealthcheck(clock, &retryConfig, &healthcheckConfig)
	assert.Nil(t, err)
}

func TestHealthcheckReturnsErrorWhenPredicatesDoNotPass(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	retryConfig := client.RetryConfig{
		Attempts:    3,
		SleepMillis: 50,
	}
	httpClient := MockHTTPClient{
		failureAfter: 1,
		okAfter:      4,
	}

	healthcheckConfig := client.HealthcheckConfig{
		URL:             "mock/healthcheck",
		BodyPredicate:   func(bytes []byte) bool { return true },
		StatusPredicate: func(code int) bool { return code == 200 },
		HTTPClient:      &httpClient,
	}

	testutils.AdvanceTimeInBackground(
		clock,
		retryConfig.Attempts,
		time.Duration(retryConfig.SleepMillis+1)*time.Millisecond,
	)

	err := client.WaitForHealthcheck(clock, &retryConfig, &healthcheckConfig)
	assert.Error(t, err)
}

func TestHealthcheckReturnsErrorWhenHTTPClientReturnsError(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	retryConfig := client.RetryConfig{
		Attempts:    2,
		SleepMillis: 50,
	}
	httpClient := MockHTTPClient{
		failureAfter: 3,
		okAfter:      4,
	}

	healthcheckConfig := client.HealthcheckConfig{
		URL:             "mock/healthcheck",
		BodyPredicate:   func(bytes []byte) bool { return true },
		StatusPredicate: func(code int) bool { return code == 200 || code == 400 },
		HTTPClient:      &httpClient,
	}

	testutils.AdvanceTimeInBackground(
		clock,
		retryConfig.Attempts,
		time.Duration(retryConfig.SleepMillis+1)*time.Millisecond,
	)

	err := client.WaitForHealthcheck(clock, &retryConfig, &healthcheckConfig)
	assert.Error(t, err)
}
