package remedies_test

import (
	"fmt"
	"lunar/engine/actions"
	lunarMessages "lunar/engine/messages"
	"lunar/engine/services/remedies"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestOnRequestWithNoCachedResponseReturnNoOpAction(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewResponseBasedThrottlingPlugin(clock)
	remedyConfig := basicRemedyConfig()
	onRequestArgs := onRequestArgs()

	action, err := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, err)

	assert.Equal(t, &actions.NoOpAction{}, action)
}

func TestOnRequestWithCachedResponseReturnEarlyResponseAction(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewResponseBasedThrottlingPlugin(clock)
	remedyConfig := basicRemedyConfig()
	onRequestArgs := onRequestArgs()
	onResponseArgs := responseArgs(map[string]string{"Retry-After": "1"})

	respAction, onResponseErr := plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
	)
	assert.Nil(t, onResponseErr)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	action, onRequestErr := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr)

	assert.Equal(t, &actions.EarlyResponseAction{
		Status:  onResponseArgs.Status,
		Body:    onResponseArgs.Body,
		Headers: onResponseArgs.Headers,
	}, action)
}

func TestResponseWithIrrelevantStatusCodeIsNotCached(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewResponseBasedThrottlingPlugin(clock)
	remedyConfig := basicRemedyConfig()
	onResponseArgs := basicResponseArgs(404, "Not found", map[string]string{})
	onRequestArgs := onRequestArgs()

	respAction, onResponseErr := plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
	)
	assert.Nil(t, onResponseErr)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	action, onRequestErr := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr)

	assert.Equal(t, &actions.NoOpAction{}, action)
}

func TestResponseWithoutRetryAfterHeaderIsNotCached(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewResponseBasedThrottlingPlugin(clock)
	remedyConfig := basicRemedyConfig()
	onResponseArgs := basicResponseArgs(
		429,
		"Too many requests",
		map[string]string{},
	)
	onRequestArgs := onRequestArgs()

	respAction, onResponseErr := plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
	)
	assert.Nil(t, onResponseErr)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	action, onRequestErr := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr)

	assert.Equal(t, &actions.NoOpAction{}, action)
}

func TestResponseWithRelevantStatusCodeAndRetryAfterHeaderIsCached(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewResponseBasedThrottlingPlugin(clock)
	remedyConfig := basicRemedyConfig()
	onResponseArgs := responseArgs(map[string]string{"Retry-After": "1"})
	onRequestArgs := onRequestArgs()

	respAction, onResponseErr := plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
	)
	assert.Equal(t, &actions.NoOpAction{}, respAction)
	assert.Nil(t, onResponseErr)

	action, onRequestErr := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr)

	assert.Equal(t, &actions.EarlyResponseAction{
		Body:    onResponseArgs.Body,
		Headers: onResponseArgs.Headers,
		Status:  onResponseArgs.Status,
	}, action)
}

func TestResponseWithRetryAfterAbsoluteEpochIsCached(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewResponseBasedThrottlingPlugin(clock)
	remedyConfig := remedyConfig(
		sharedConfig.RetryAfterAbsoluteEpoch,
		[]int{429},
	)
	retryAfter := clock.Now().Add(1 * time.Second).Unix()
	onResponseArgs := responseArgs(
		map[string]string{"Retry-After": fmt.Sprintf("%v", retryAfter)},
	)
	onRequestArgs := onRequestArgs()

	respAction, onResponseErr := plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
	)
	assert.Nil(t, onResponseErr)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	action, onRequestErr := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr)

	assert.Equal(t, &actions.EarlyResponseAction{
		Body:    onResponseArgs.Body,
		Headers: onResponseArgs.Headers,
		Status:  onResponseArgs.Status,
	}, action)
}

func TestOnResponsesWithDifferentStatusCodesOnlyCacheRelevantStatusCodes(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewResponseBasedThrottlingPlugin(clock)
	remedyConfig := remedyConfig(
		sharedConfig.RetryAfterRelativeSeconds,
		[]int{500},
	)
	rateLimitResponse := responseArgs(
		map[string]string{"Retry-After": "1"},
	)
	serverErrorResponse := basicResponseArgs(
		500,
		"Internal server error",
		map[string]string{"Retry-After": "1"},
	)
	onRequestArgs := onRequestArgs()

	respAction1, onResponseErr1 := plugin.OnResponse(
		rateLimitResponse,
		&remedyConfig,
	)
	assert.Nil(t, onResponseErr1)
	assert.Equal(t, &actions.NoOpAction{}, respAction1)

	action1, onRequestErr1 := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr1)

	respAction2, onResponseErr2 := plugin.OnResponse(
		serverErrorResponse,
		&remedyConfig,
	)
	assert.Nil(t, onResponseErr2)
	assert.Equal(t, &actions.NoOpAction{}, respAction2)

	action2, onRequestErr2 := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr2)

	assert.Equal(t, &actions.NoOpAction{}, action1)
	assert.Equal(t, &actions.EarlyResponseAction{
		Body:    serverErrorResponse.Body,
		Headers: serverErrorResponse.Headers,
		Status:  serverErrorResponse.Status,
	}, action2)
}

func TestRateLimitResponsesAreServedForDurationOfWindow(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewResponseBasedThrottlingPlugin(clock)
	remedyConfig := basicRemedyConfig()
	onResponseArgs := responseArgs(map[string]string{"Retry-After": "1"})
	onRequestArgs := onRequestArgs()

	respAction, onResponseErr := plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
	)
	assert.Nil(t, onResponseErr)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	action1, onRequestErr1 := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr1)

	action2, onRequestErr2 := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr2)

	clock.AdvanceTime(plusEpsilon(1 * time.Second))

	action3, onRequestErr3 := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr3)

	assert.Equal(t, &actions.EarlyResponseAction{
		Body:    onResponseArgs.Body,
		Headers: onResponseArgs.Headers,
		Status:  onResponseArgs.Status,
	}, action1)
	assert.Equal(t, &actions.EarlyResponseAction{
		Body:    onResponseArgs.Body,
		Headers: onResponseArgs.Headers,
		Status:  onResponseArgs.Status,
	}, action2)
	assert.Equal(t, &actions.NoOpAction{}, action3)
}

func TestCachedRateLimitResponsesHaveUpdatedRetryAfter(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewResponseBasedThrottlingPlugin(clock)
	remedyConfig := basicRemedyConfig()
	onResponseArgs := responseArgs(map[string]string{"Retry-After": "2"})
	onRequestArgs := onRequestArgs()
	timeToSleep := 1
	wantHeaders := map[string]string{}
	for k, v := range onResponseArgs.Headers {
		wantHeaders[k] = v
	}
	newRetryAfter, intParseErr := strconv.Atoi(
		onResponseArgs.Headers["Retry-After"],
	)
	assert.Nil(t, intParseErr)

	wantHeaders["Retry-After"] = strconv.FormatInt(
		int64(newRetryAfter-timeToSleep), 10,
	)

	respAction, onResponseErr := plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
	)
	assert.Nil(t, onResponseErr)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	action1, onRequestErr1 := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr1)

	clock.AdvanceTime(time.Duration(timeToSleep) * time.Second)

	action2, onRequestErr2 := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr2)

	clock.AdvanceTime(time.Duration(timeToSleep) * time.Second)

	action3, onRequestErr3 := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr3)

	assert.Equal(t, &actions.EarlyResponseAction{
		Body:    onResponseArgs.Body,
		Headers: onResponseArgs.Headers,
		Status:  onResponseArgs.Status,
	}, action1)
	assert.Equal(t, &actions.EarlyResponseAction{
		Body:    onResponseArgs.Body,
		Headers: wantHeaders,
		Status:  onResponseArgs.Status,
	}, action2)
	assert.Equal(t, &actions.NoOpAction{}, action3)
}

func TestCachedRateLimitResponsesHaveUpdatedRetryAfterWithAbsoluteEpoch(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewResponseBasedThrottlingPlugin(clock)
	remedyConfig := remedyConfig(
		sharedConfig.RetryAfterAbsoluteEpoch,
		[]int{429},
	)
	retryAfter := clock.Now().Add(2 * time.Second).Unix()
	onResponseArgs := responseArgs(
		map[string]string{"Retry-After": fmt.Sprintf("%v", retryAfter)},
	)
	onRequestArgs := onRequestArgs()
	timeToSleep := 1
	respAction, onResponseErr := plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
	)
	assert.Nil(t, onResponseErr)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	action1, onRequestErr1 := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr1)

	clock.AdvanceTime(plusEpsilon(time.Duration(timeToSleep) * time.Second))
	action2, onRequestErr2 := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr2)

	clock.AdvanceTime(plusEpsilon(time.Duration(timeToSleep) * time.Second))
	action3, onRequestErr3 := plugin.OnRequest(onRequestArgs, &remedyConfig)
	assert.Nil(t, onRequestErr3)

	assert.Equal(t, &actions.EarlyResponseAction{
		Body:    onResponseArgs.Body,
		Headers: onResponseArgs.Headers,
		Status:  onResponseArgs.Status,
	}, action1)
	assert.Equal(t, &actions.EarlyResponseAction{
		Body:    onResponseArgs.Body,
		Headers: onResponseArgs.Headers,
		Status:  onResponseArgs.Status,
	}, action2)
	assert.Equal(t, &actions.NoOpAction{}, action3)
}

func plusEpsilon(timeToWait time.Duration) time.Duration {
	epsilon := 1 * time.Nanosecond
	return timeToWait + epsilon
}

func responseArgs(headers map[string]string) lunarMessages.OnResponse {
	return basicResponseArgs(
		429,
		"{ \"error\": \"Too many requests\" }",
		headers,
	)
}

func remedyConfig(
	retryAfterType sharedConfig.RetryAfterType,
	relevantStatuses []int,
) sharedConfig.ResponseBasedThrottlingConfig {
	return sharedConfig.ResponseBasedThrottlingConfig{
		QuotaGroup:       1,
		RetryAfterHeader: "Retry-After",
		RetryAfterType:   retryAfterType,
		RelevantStatuses: relevantStatuses,
	}
}

func basicRemedyConfig() sharedConfig.ResponseBasedThrottlingConfig {
	return sharedConfig.ResponseBasedThrottlingConfig{
		QuotaGroup:       1,
		RetryAfterHeader: "Retry-After",
		RetryAfterType:   sharedConfig.RetryAfterRelativeSeconds,
		RelevantStatuses: []int{429},
	}
}
