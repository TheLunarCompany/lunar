//go:build !pro

package limit

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
	windowSize    time.Duration
	windowEndTime time.Time
	mutex         sync.Mutex
}

func newSingleRateLimitState(clock clock.Clock) *singleRateLimitState {
	return &singleRateLimitState{
		clock:         clock,
		counter:       0,
		windowSize:    1,
		windowEndTime: clock.Now(),
		mutex:         sync.Mutex{},
	}
}

func (state *singleRateLimitState) TryToIncrement(
	windowData WindowData,
) CurrentLimitState {
	state.mutex.Lock()
	defer state.mutex.Unlock()

	state.windowSize = windowData.WindowSize
	state.ensureWindowIsUpdated()

	maxAllowedInWindows := int64(math.Ceil(float64(
		windowData.AllowedRequestCount) * windowData.QuotaAllocationRatio))
	if state.counter >= maxAllowedInWindows {
		return CurrentLimitState{state.counter, Block}
	}

	state.counter++
	return CurrentLimitState{state.counter, Proceed}
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
		(elapsedTime / state.windowSize) * state.windowSize,
	)
	currentWindowEndTime := currentWindowStartTime.Add(state.windowSize)

	// We make sure that state's window is is correct accordingly
	if currentTime.After(state.windowEndTime) {
		state.counter = 0
		state.windowEndTime = currentWindowEndTime
	}
}
