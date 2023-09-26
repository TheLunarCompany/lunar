package limit_test

import (
	"lunar/engine/utils"
	"lunar/engine/utils/limit"
	"lunar/toolkit-core/clock"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestHappyFlowForRateLimitState(
	t *testing.T,
) {
	t.Parallel()
	testArgs := []limit.RequestArguments{
		{
			RequestScope: utils.ScopeGlobal,
			Grouping:     limit.Ungrouped,
		},
		{
			RequestScope: utils.ScopeGlobal,
			Grouping:     limit.Grouped,
			GroupID:      "group-id",
		},
		{
			RequestScope:  utils.ScopeEndpoint,
			Grouping:      limit.Ungrouped,
			Method:        "GET",
			NormalizedURL: "/api/v1/users",
		},
		{
			RequestScope:  utils.ScopeEndpoint,
			Grouping:      limit.Grouped,
			GroupID:       "group-id",
			Method:        "GET",
			NormalizedURL: "/api/v1/users",
		},
	}

	for _, requestArgs := range testArgs {
		mockClock := clock.NewMockClock()
		windowSize := time.Duration(1) * time.Second
		state := limit.NewRateLimitStateByEndpoint(mockClock)

		counter := incrementNTimes(t, 3, state, requestArgs, windowSize)
		assert.Equal(t, 3, counter)

		mockClock.AdvanceTime(time.Duration(1) * time.Second)

		counter = incrementNTimes(t, 2, state, requestArgs, windowSize)
		assert.Equal(t, 2, counter)
	}
}

func TestWhenRequiredArgumentsAreMissingThenErrorIsReturned(
	t *testing.T,
) {
	t.Parallel()
	testArgs := []limit.RequestArguments{
		{
			RequestScope: utils.ScopeEndpoint,
			Grouping:     limit.Ungrouped,
		},
		{
			RequestScope:  utils.ScopeEndpoint,
			Grouping:      limit.Grouped,
			Method:        "GET",
			NormalizedURL: "/api/v1/users",
		},
		{
			RequestScope: utils.ScopeGlobal,
			Grouping:     limit.Grouped,
		},
	}

	for _, requestArgs := range testArgs {
		assertRateLimitError(t, requestArgs)
	}
}

func TestWhenUsingGlobalAndEndpointScopesThenStateIsIsolated(
	t *testing.T,
) {
	t.Parallel()

	testArgs := []limit.RequestArguments{
		{
			RequestScope: utils.ScopeGlobal,
			Grouping:     limit.Ungrouped,
		},
		{
			RequestScope: utils.ScopeGlobal,
			Grouping:     limit.Grouped,
			GroupID:      "group-id",
		},
		{
			RequestScope:  utils.ScopeEndpoint,
			Grouping:      limit.Ungrouped,
			Method:        "GET",
			NormalizedURL: "/api/v1/users",
		},
		{
			RequestScope:  utils.ScopeEndpoint,
			Grouping:      limit.Grouped,
			GroupID:       "group-id",
			Method:        "GET",
			NormalizedURL: "/api/v1/users",
		},
	}

	for _, firstArgs := range testArgs {
		for _, secondArgs := range testArgs {
			if firstArgs.RequestScope == secondArgs.RequestScope {
				continue
			}
			testStatesAreIsolated(t, firstArgs, secondArgs)
		}
	}
}

func assertRateLimitError(
	t *testing.T,
	requestArgs limit.RequestArguments,
) {
	mockClock := clock.NewMockClock()
	windowSize := time.Duration(1) * time.Second
	state := limit.NewRateLimitStateByEndpoint(mockClock)

	_, err := state.Increment(requestArgs, windowSize)
	assert.NotNil(t, err)
}

func testStatesAreIsolated(
	t *testing.T,
	firstArgs limit.RequestArguments,
	secondArgs limit.RequestArguments,
) {
	mockClock := clock.NewMockClock()
	windowSize := time.Duration(1) * time.Second
	state := limit.NewRateLimitStateByEndpoint(mockClock)

	counter := incrementNTimes(t, 3, state, firstArgs, windowSize)
	assert.Equal(t, 3, counter)

	counter = incrementNTimes(t, 2, state, secondArgs, windowSize)
	assert.Equal(t, 2, counter)

	counter = incrementNTimes(t, 3, state, firstArgs, windowSize)
	assert.Equal(t, 6, counter)

	counter = incrementNTimes(t, 2, state, secondArgs, windowSize)
	assert.Equal(t, 4, counter)

	counter = incrementNTimes(t, 3, state, firstArgs, windowSize)
	assert.Equal(t, 9, counter)
}

func incrementNTimes(
	t *testing.T,
	numIterations int,
	state *limit.RateLimitStateByEndpoint,
	args limit.RequestArguments,
	windowSize time.Duration,
) int {
	var finalCounter int
	for i := 0; i < numIterations; i++ {
		counter, err := state.Increment(args, windowSize)
		assert.Nil(t, err)
		finalCounter = counter
	}
	return finalCounter
}
