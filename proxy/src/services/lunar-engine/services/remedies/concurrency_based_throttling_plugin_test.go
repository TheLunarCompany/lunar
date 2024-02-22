package remedies_test

import (
	"lunar/engine/actions"
	"lunar/engine/config"
	"lunar/engine/services/remedies"
	"lunar/engine/utils"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

var earlyResponseAction = actions.EarlyResponseAction{
	Status: 429,
	Body:   "Too many requests",
	Headers: map[string]string{
		"Content-Type": "text/plain",
	},
}

func TestItReturnsNoActionWhenOnRequestWhenLimitAllowsNewRequest(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	proxyTimeout := 5 * time.Second
	plugin := remedies.NewConcurrencyBasedThrottlingPlugin(clock, proxyTimeout)
	scopedRemedy := buildConcurrencyBasedThrottlingScopedRemedy(2, 429)

	reqA := onRequestArgs()
	reqA.ID = "1"
	action, err := plugin.OnRequest(reqA, scopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)

	reqB := onRequestArgs()
	reqB.ID = "2"
	action, err = plugin.OnRequest(reqB, scopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)
}

func TestItReturnsEarlyResponseWhenOnRequestWhenLimitDisallowsNewRequest(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	proxyTimeout := 5 * time.Second
	plugin := remedies.NewConcurrencyBasedThrottlingPlugin(clock, proxyTimeout)
	scopedRemedy := buildConcurrencyBasedThrottlingScopedRemedy(1, 429)

	reqA := onRequestArgs()
	reqA.ID = "1"
	action, err := plugin.OnRequest(reqA, scopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)

	reqB := onRequestArgs()
	reqB.ID = "2"
	action, err = plugin.OnRequest(reqB, scopedRemedy)
	assert.Nil(t, err)
	assert.Equal(
		t,
		&earlyResponseAction,
		action,
	)
}

func TestItReturnsNoActionWhenOnRequestWhenLimitAllowsNewRequestAfterRelease(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	proxyTimeout := 5 * time.Second
	plugin := remedies.NewConcurrencyBasedThrottlingPlugin(clock, proxyTimeout)
	scopedRemedy := buildConcurrencyBasedThrottlingScopedRemedy(1, 429)

	reqA := onRequestArgs()
	reqA.ID = "1"
	action, err := plugin.OnRequest(reqA, scopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)

	respA := basicResponseArgs(200, "", map[string]string{})
	respA.ID = "1"
	respAction, err := plugin.OnResponse(respA, scopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	reqB := onRequestArgs()
	reqB.ID = "2"
	action, err = plugin.OnRequest(reqB, scopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)
}

func TestItReturnsNoActionWhenOnRequestWhenLimitAllowsNewRequestWithNoReleaseAfterTimeout(
	t *testing.T,
) {
	t.Skip("This test is flaky!")
	t.Parallel()
	clock := clock.NewMockClock()
	proxyTimeout := 5 * time.Second
	plugin := remedies.NewConcurrencyBasedThrottlingPlugin(clock, proxyTimeout)
	scopedRemedy := buildConcurrencyBasedThrottlingScopedRemedy(1, 429)

	reqA := onRequestArgs()
	reqA.ID = "1"
	action, err := plugin.OnRequest(reqA, scopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)

	clock.AdvanceTime(proxyTimeout + 1)
	time.Sleep(1 * time.Millisecond)

	reqB := onRequestArgs()
	reqB.ID = "2"
	action, err = plugin.OnRequest(reqB, scopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)
}

func TestItAllowsConfigToIncreaseConcurrencyLimit(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	proxyTimeout := 5 * time.Second
	plugin := remedies.NewConcurrencyBasedThrottlingPlugin(clock, proxyTimeout)
	initialScopedRemedy := buildConcurrencyBasedThrottlingScopedRemedy(1, 429)

	reqA := onRequestArgs()
	reqA.ID = "1"
	action, err := plugin.OnRequest(reqA, initialScopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)

	reqB := onRequestArgs()
	reqB.ID = "2"
	action, err = plugin.OnRequest(reqB, initialScopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &earlyResponseAction, action)

	// New config comes in and increases maxConcurrentRequests from 1 to 2
	updatedScopedRemedy := buildConcurrencyBasedThrottlingScopedRemedy(2, 429)
	action, err = plugin.OnRequest(reqB, updatedScopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)
}

func TestItAllowsConfigToDecreaseConcurrencyLimit(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	proxyTimeout := 5 * time.Second
	plugin := remedies.NewConcurrencyBasedThrottlingPlugin(clock, proxyTimeout)
	initialScopedRemedy := buildConcurrencyBasedThrottlingScopedRemedy(2, 429)

	reqA := onRequestArgs()
	reqA.ID = "1"
	action, err := plugin.OnRequest(reqA, initialScopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)

	reqB := onRequestArgs()
	reqB.ID = "2"
	action, err = plugin.OnRequest(reqB, initialScopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)

	// New config comes in and decreases maxConcurrentRequests from 2 to 1
	updatedScopedRemedy := buildConcurrencyBasedThrottlingScopedRemedy(1, 429)

	reqC := onRequestArgs()
	reqC.ID = "3"
	action, err = plugin.OnRequest(reqC, updatedScopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &earlyResponseAction, action)

	// responses for the first 2 request now arrive (with updated config)
	respA := basicResponseArgs(200, "", map[string]string{})
	respA.ID = "1"
	respAction, err := plugin.OnResponse(respA, updatedScopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	// responses for the first 2 request now arrive (with updated config)
	respB := basicResponseArgs(200, "", map[string]string{})
	respB.ID = "2"
	respAction, err = plugin.OnResponse(respB, updatedScopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	// now there is a slot available for the third request
	action, err = plugin.OnRequest(reqC, updatedScopedRemedy)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)
}

func buildConcurrencyBasedThrottlingScopedRemedy(
	maxConcurrentRequests int,
	responseStatusCode int,
) config.ScopedRemedy {
	remedyConfig := sharedConfig.ConcurrencyBasedThrottlingConfig{
		MaxConcurrentRequests: maxConcurrentRequests,
		ResponseStatusCode:    responseStatusCode,
	}
	remedy := sharedConfig.Remedy{
		Enabled: true,
		Name:    "test",
		Config: sharedConfig.RemedyConfig{
			ConcurrencyBasedThrottling: &remedyConfig,
		},
	}
	return config.ScopedRemedy{
		Scope:         utils.ScopeEndpoint,
		Method:        "GET",
		NormalizedURL: "twitter.com/user/{id}",
		Remedy:        &remedy,
	}
}
