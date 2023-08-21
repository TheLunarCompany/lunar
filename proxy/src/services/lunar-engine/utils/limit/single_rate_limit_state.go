package limit

import (
	"lunar/toolkit-core/clock"
	"sync"
	"time"
)

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
	currentTime := state.clock.Now()
	if currentTime.After(state.windowEndTime) {
		state.counter = 0
		state.windowEndTime = currentTime.Add(windowSize)
	}
}
