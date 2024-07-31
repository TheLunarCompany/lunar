package processorbasicratelimiter

import (
	"lunar/toolkit-core/clock"
	"math"
	"sync"
	"time"
)

var epochTime = time.Unix(0, 0)

type singleRateLimitState struct {
	clock clock.Clock

	counter       int64
	windowData    windowData
	windowEndTime time.Time
	mutex         sync.Mutex
}

func (state *singleRateLimitState) TryToIncrement(windowData windowData) *currentLimitState {
	state.mutex.Lock()
	defer state.mutex.Unlock()
	state.windowData = windowData
	state.ensureWindowIsUpdated()

	maxAllowedInWindows := int64(math.Ceil(float64(
		windowData.AllowedRequestCount) *
		windowData.QuotaAllocationRatio))
	if state.counter >= maxAllowedInWindows {
		return &currentLimitState{state.counter, Block}
	}

	state.counter++
	return &currentLimitState{state.counter, Proceed}
}

func (state *singleRateLimitState) Counter() int64 {
	// Note: windowSize might not be up-to-date if Increment() was not called
	// after windowSize was changed using apply_policies.
	// This is an edge-case which only happens if apply_policies was called
	// but no requests were made since then.
	state.mutex.Lock()
	defer state.mutex.Unlock()

	state.ensureWindowIsUpdated()
	return state.counter
}

func (state *singleRateLimitState) ensureWindowIsUpdated() {
	// In order to ensure proper support for use-cases such as remedy chaining,
	// we align windows on an imaginary grid.
	// This is done by starting the count of passed windows from the
	// initial epoch time in order to compute windows' start (and end) times.
	currentTime := state.clock.Now()
	elapsedTime := currentTime.Sub(epochTime)

	// These two values represent the correct window we should be working within.
	// The equation is not redundant - it is used for flooring purposes
	currentWindowStartTime := epochTime.Add(
		(elapsedTime / state.windowData.WindowSize) * state.windowData.WindowSize,
	)
	currentWindowEndTime := currentWindowStartTime.Add(state.windowData.WindowSize)

	// We make sure that state's window is is correct accordingly
	if currentTime.After(state.windowEndTime) {
		state.counter = 0
		state.windowEndTime = currentWindowEndTime
	}
}

func newSingleRateLimitState(clock clock.Clock) *singleRateLimitState {
	return &singleRateLimitState{
		clock:   clock,
		counter: 0,
		windowData: windowData{
			WindowSize:           0,
			AllowedRequestCount:  0,
			QuotaAllocationRatio: 0,
		},
		windowEndTime: epochTime,
		mutex:         sync.Mutex{},
	}
}
