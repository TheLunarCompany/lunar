package limit

import (
	"lunar/toolkit-core/clock"
	"sync"
	"time"
)

var epochTime = time.Unix(0, 0)

type singleRateLimitState struct {
	clock clock.Clock

	counter       int
	windowEndTime time.Time

	mutex sync.RWMutex
}

func newSingleRateLimitState(clock clock.Clock) *singleRateLimitState {
	return &singleRateLimitState{
		clock:         clock,
		counter:       0,
		windowEndTime: clock.Now(),
		mutex:         sync.RWMutex{},
	}
}

func (state *singleRateLimitState) Increment(windowSize time.Duration) int {
	state.mutex.Lock()
	defer state.mutex.Unlock()

	ensureWindowIsUpdated(state, windowSize)

	state.counter++
	return state.counter
}

func ensureWindowIsUpdated(
	state *singleRateLimitState,
	windowSize time.Duration,
) {
	// In order to ensure proper support for use-cases such as remedy chaining,
	// we align windows on an imaginary grid.
	// This is done by starting the count of passed windows from the
	// initial epoch time in order to compute windows' start (and end) times.
	currentTime := state.clock.Now()
	elapsedTime := currentTime.Sub(epochTime)

	// These two values represent the correct window we should be working within.
	// The equation is not redundant - it is used for flooring purposes
	currentWindowStartTime := epochTime.Add(
		(elapsedTime / windowSize) * windowSize,
	)
	currentWindowEndTime := currentWindowStartTime.Add(windowSize)

	// We make sure that state's window is is correct accordingly
	if currentTime.After(state.windowEndTime) {
		state.counter = 0
		state.windowEndTime = currentWindowEndTime
	}
}
