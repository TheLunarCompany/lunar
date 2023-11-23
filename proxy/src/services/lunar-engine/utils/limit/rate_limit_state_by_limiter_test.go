package limit_test

import (
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
			LimiterID: "Global",
			Grouping:  limit.Ungrouped,
		},
		{
			LimiterID: "Global",
			Grouping:  limit.Grouped,
			GroupID:   "group-id",
		},
		{
			LimiterID: "Endpoint A",
			Grouping:  limit.Ungrouped,
		},
		{
			LimiterID: "Endpoint A",
			Grouping:  limit.Grouped,
			GroupID:   "group-id",
		},
	}

	for _, requestArgs := range testArgs {
		mockClock := clock.NewMockClock()
		windowSize := time.Duration(1) * time.Second
		state := limit.NewRateLimitState(mockClock)

		counter := incrementNTimes(t, 3, state, requestArgs, windowSize)
		assert.Equal(t, 3, counter)

		mockClock.AdvanceTime(time.Duration(1) * time.Second)

		counter = incrementNTimes(t, 2, state, requestArgs, windowSize)
		assert.Equal(t, 2, counter)
	}
}

func TestWhenGroupIDMissingForGroupedRequiredArgumentsThenErrorIsReturned(
	t *testing.T,
) {
	t.Parallel()
	requestArgs := limit.RequestArguments{
		LimiterID: "foo",
		Grouping:  limit.Grouped,
	}

	assertRateLimitError(t, requestArgs)
}

func TestWhenLimiterIDIsMissingInRequiredArgumentsThenErrorIsReturned(
	t *testing.T,
) {
	t.Parallel()
	requestArgs := limit.RequestArguments{
		Grouping: limit.Ungrouped,
	}

	assertRateLimitError(t, requestArgs)
}

func TestStateIsIsolatedByLimiterID(
	t *testing.T,
) {
	t.Parallel()

	testArgs := []limit.RequestArguments{
		{
			LimiterID: "Global",
			Grouping:  limit.Ungrouped,
		},
		{
			LimiterID: "Global",
			Grouping:  limit.Grouped,
			GroupID:   "group-id",
		},
		{
			LimiterID: "Endpoint A",
			Grouping:  limit.Ungrouped,
		},
		{
			LimiterID: "Endpoint A",
			Grouping:  limit.Grouped,
			GroupID:   "group-id",
		},
	}

	for _, firstArgs := range testArgs {
		for _, secondArgs := range testArgs {
			if firstArgs.LimiterID == secondArgs.LimiterID {
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
	state := limit.NewRateLimitState(mockClock)

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
	state := limit.NewRateLimitState(mockClock)

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
	state *limit.RateLimitState,
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
