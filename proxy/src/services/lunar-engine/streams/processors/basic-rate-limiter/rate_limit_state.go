package processorbasicratelimiter

import (
	"fmt"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"sync"
	"time"
)

type currentState int

const (
	Block currentState = iota
	Proceed
)

type currentLimitState struct {
	NewCounter int64
	LimitSate  currentState
}

type requestArguments struct {
	LimiterID string
}

type windowData struct {
	WindowSize           time.Duration
	AllowedRequestCount  int64
	QuotaAllocationRatio float64
}

type rateLimitState struct {
	clock                clock.Clock
	groupsStateByLimiter map[requestArguments]*singleRateLimitState
	mutex                sync.Mutex
	cl                   logging.ContextLogger
}

func newRateLimitState(clock clock.Clock, contextLogger logging.ContextLogger) *rateLimitState {
	return &rateLimitState{
		clock:                clock,
		groupsStateByLimiter: map[requestArguments]*singleRateLimitState{},
		mutex:                sync.Mutex{},
		cl:                   contextLogger.WithComponent("rate-limit-state"),
	}
}

func (state *rateLimitState) TryToIncrement(
	requestArgs requestArguments,
	winData windowData,
) (*currentLimitState, error) {
	if requestArgs.LimiterID == "" {
		return nil, fmt.Errorf("limiter ID is missing")
	}

	groupedState := state.getLimiterState(requestArgs)
	return groupedState.TryToIncrement(winData), nil
}

func (state *rateLimitState) Counters() map[requestArguments]int64 {
	counters := map[requestArguments]int64{}

	state.mutex.Lock()
	defer state.mutex.Unlock()

	for requestArgs, singleLimiter := range state.groupsStateByLimiter {
		counters[requestArgs] = singleLimiter.Counter()
	}

	return counters
}

func (state *rateLimitState) getLimiterState(requestArgs requestArguments) *singleRateLimitState {
	state.mutex.Lock()
	defer state.mutex.Unlock()

	if _, found := state.groupsStateByLimiter[requestArgs]; !found {
		newSingleLimit := newSingleRateLimitState(state.clock)
		state.groupsStateByLimiter[requestArgs] = newSingleLimit
	}

	return state.groupsStateByLimiter[requestArgs]
}
