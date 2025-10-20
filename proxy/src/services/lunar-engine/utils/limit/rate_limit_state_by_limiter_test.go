//go:build !pro

package limit_test

import (
	"lunar/engine/utils/limit"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestHappyFlowForRateLimitStateWithSpillover(
	t *testing.T,
) {
	t.Parallel()
	testArgs := createTestArgs()

	for _, requestArgs := range testArgs {
		mockClock := clock.NewMockClock()
		windowSize := time.Duration(1) * time.Second
		state := limit.NewRateLimitState(
			mockClock,
			logging.ContextLogger{},
		).(*limit.RateLimitState)

		windowsData := limit.WindowData{
			WindowSize:           windowSize,
			AllowedRequestCount:  3,
			QuotaAllocationRatio: 1,
			SpilloverEnabled:     true,
			SpilloverRenewOnDay:  getSpilloverRenewOnDay(),
		}

		counter := incrementNTimes(t, 2, state, requestArgs, windowsData)
		assert.Equal(t, int64(2), counter)

		mockClock.AdvanceTime(time.Duration(1) * time.Second)

		counter = incrementNTimes(t, 4, state, requestArgs, windowsData)
		assert.Equal(t, int64(4), counter)

		limitState, err := state.TryToIncrement(requestArgs, windowsData)
		assert.Nil(t, err)
		assert.Equal(t, limit.Block, limitState.LimitSate)
	}
}

func createTestArgs() []limit.RequestArguments {
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
	return testArgs
}

func TestHappyFlowForRateLimitState(
	t *testing.T,
) {
	t.Parallel()
	testArgs := createTestArgs()
	for _, requestArgs := range testArgs {
		mockClock := clock.NewMockClock()
		windowSize := time.Duration(1) * time.Second
		state := limit.NewRateLimitState(
			mockClock,
			logging.ContextLogger{},
		).(*limit.RateLimitState)

		firstWindowsData := limit.WindowData{
			WindowSize:           windowSize,
			AllowedRequestCount:  3,
			QuotaAllocationRatio: 1,
		}

		secondWindowsData := limit.WindowData{
			WindowSize:           windowSize,
			AllowedRequestCount:  2,
			QuotaAllocationRatio: 1,
		}

		counter := incrementNTimes(t, 3, state, requestArgs, firstWindowsData)
		assert.Equal(t, int64(3), counter)

		mockClock.AdvanceTime(time.Duration(1) * time.Second)

		counter = incrementNTimes(t, 2, state, requestArgs, secondWindowsData)
		assert.Equal(t, int64(2), counter)
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
	state := limit.NewRateLimitState(mockClock, logging.ContextLogger{})

	windowData := limit.WindowData{
		WindowSize:           windowSize,
		AllowedRequestCount:  0,
		QuotaAllocationRatio: 1,
	}

	_, err := state.TryToIncrement(requestArgs, windowData)
	assert.NotNil(t, err)
}

func testStatesAreIsolated(
	t *testing.T,
	firstArgs limit.RequestArguments,
	secondArgs limit.RequestArguments,
) {
	mockClock := clock.NewMockClock()
	windowSize := time.Duration(1) * time.Second
	state := limit.NewRateLimitState(
		mockClock,
		logging.ContextLogger{},
	).(*limit.RateLimitState)
	firstWindowsData := limit.WindowData{
		WindowSize:           windowSize,
		AllowedRequestCount:  9,
		QuotaAllocationRatio: 1,
	}

	secondWindowsData := limit.WindowData{
		WindowSize:           windowSize,
		AllowedRequestCount:  9,
		QuotaAllocationRatio: 1,
	}

	counter := incrementNTimes(t, 3, state, firstArgs, firstWindowsData)
	assert.Equal(t, int64(3), counter)

	counter = incrementNTimes(t, 2, state, secondArgs, secondWindowsData)
	assert.Equal(t, int64(2), counter)

	counter = incrementNTimes(t, 3, state, firstArgs, firstWindowsData)
	assert.Equal(t, int64(6), counter)

	counter = incrementNTimes(t, 2, state, secondArgs, secondWindowsData)
	assert.Equal(t, int64(4), counter)

	counter = incrementNTimes(t, 3, state, firstArgs, firstWindowsData)
	assert.Equal(t, int64(9), counter)
}

func incrementNTimes(
	t *testing.T,
	numIterations int,
	state *limit.RateLimitState,
	args limit.RequestArguments,
	windowData limit.WindowData,
) int64 {
	var finalCounter int64

	for i := 0; i < numIterations; i++ {
		limitState, err := state.TryToIncrement(args, windowData)
		assert.Nil(t, err)
		finalCounter = limitState.NewCounter
	}
	return finalCounter
}

func getSpilloverRenewOnDay() int {
	// Test will fail if run on the SpilloverRenewOnDay,
	// hence we need to set it to the next day.
	spilloverRenewOnDay := time.Now().Day() + 1
	if spilloverRenewOnDay > 28 {
		spilloverRenewOnDay = 1
	}
	return spilloverRenewOnDay
}
