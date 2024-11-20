package remedies_test

import (
	"lunar/engine/actions"
	"lunar/engine/messages"
	"lunar/engine/services/remedies"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestItReturnsInitialCooldownSecondsOnFirstRetryEligibleResponse(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewRetryPlugin(clock)

	config := buildRetryConfig()

	onResponse := buildRetryOnResponse(500, "a", "a")
	action, err := plugin.OnResponse(onResponse, &config)
	assert.Nil(t, err)

	wantAction := actions.ModifyResponseAction{
		HeadersToSet: map[string]string{
			remedies.LunarRetryAfterHeaderName: "5",
		},
	}
	assert.Equal(t, &wantAction, action)
}

func TestItReturnsMultipliedCooldownSecondsOnSecondRetryEligibleResponse(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewRetryPlugin(clock)

	config := buildRetryConfig()

	onResponse1 := buildRetryOnResponse(500, "a", "a")
	_, err := plugin.OnResponse(onResponse1, &config)
	onResponse2 := buildRetryOnResponse(504, "b", "a")
	assert.Nil(t, err)
	action, err := plugin.OnResponse(onResponse2, &config)
	assert.Nil(t, err)

	wantAction := actions.ModifyResponseAction{
		HeadersToSet: map[string]string{
			remedies.LunarRetryAfterHeaderName: "10",
		},
	}
	assert.Equal(t, &wantAction, action)
}

func TestItReturnsNoOpOnRetryIneligibleResponse(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewRetryPlugin(clock)

	config := buildRetryConfig()

	onResponse := buildRetryOnResponse(503, "a", "a")
	action, err := plugin.OnResponse(onResponse, &config)
	assert.Nil(t, err)

	wantAction := actions.NoOpAction{}
	assert.Equal(t, &wantAction, action)
}

func TestItReturnsNoOpWhenNoAttemptsLeftForSequence(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewRetryPlugin(clock)

	config := buildRetryConfig()

	onResponse1 := buildRetryOnResponse(500, "a", "a")
	action1, err := plugin.OnResponse(onResponse1, &config)
	assert.Nil(t, err)
	assert.NotEqual(t, &actions.NoOpAction{}, action1)

	onResponse2 := buildRetryOnResponse(500, "b", "a")
	action2, err := plugin.OnResponse(onResponse2, &config)
	assert.Nil(t, err)
	assert.NotEqual(t, &actions.NoOpAction{}, action2)

	// After 2 attempts, the sequence has no attempts left, so `NoOp` is returned
	// in order to preserve the original error's semantics
	onResponse3 := buildRetryOnResponse(500, "c", "a")
	action3, err := plugin.OnResponse(onResponse3, &config)
	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action3)
}

func buildRetryOnResponse(
	status int,
	id string,
	sequenceID string,
) messages.OnResponse {
	onResponse := basicResponseArgs(status, "{}", map[string]string{})
	onResponse.ID = id
	onResponse.SequenceID = sequenceID
	return onResponse
}

func buildRetryConfig() sharedConfig.RetryConfig {
	return sharedConfig.RetryConfig{
		Attempts:               2,
		InitialCooldownSeconds: 5,
		CooldownMultiplier:     2,
		Conditions: sharedConfig.RetryConfigConditions{
			StatusCode: []sharedConfig.Range[int]{
				// all 5xxs excluding 503
				{From: 500, To: 502},
				{From: 504, To: 599},
			},
		},
	}
}
