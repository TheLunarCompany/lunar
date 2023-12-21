//go:build !pro

package limit

import (
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"sync"
)

type RateLimitState struct {
	clock                clock.Clock
	groupsStateByLimiter map[RequestArguments]*singleRateLimitState
	mutex                sync.Mutex
	cl                   logging.ContextLogger
}

func NewRateLimitState(
	clock clock.Clock,
	contextLogger logging.ContextLogger,
) IncrementableRateLimitState {
	return &RateLimitState{
		clock:                clock,
		groupsStateByLimiter: map[RequestArguments]*singleRateLimitState{},
		mutex:                sync.Mutex{},
		cl:                   contextLogger.WithComponent("strategy-based-queue"),
	}
}

func (state *RateLimitState) TryToIncrement(
	requestArgs RequestArguments,
	windowData WindowData,
) (CurrentLimitState, error) {
	if err := validateLimitKeys(requestArgs); err != nil {
		return CurrentLimitState{0, Proceed}, err
	}

	groupedState := state.getLimiterState(requestArgs)
	return groupedState.TryToIncrement(windowData), nil
}

func (state *RateLimitState) Counters() map[RequestArguments]int64 {
	counters := map[RequestArguments]int64{}

	state.mutex.Lock()
	defer state.mutex.Unlock()

	for requestArgs, singleLimiter := range state.groupsStateByLimiter {
		counters[requestArgs] = singleLimiter.Counter()
	}

	return counters
}

func (state *RateLimitState) getLimiterState(
	requestArgs RequestArguments,
) *singleRateLimitState {
	state.mutex.Lock()
	defer state.mutex.Unlock()

	if _, found := state.groupsStateByLimiter[requestArgs]; !found {
		newSingleLimit := newSingleRateLimitState(state.clock)
		state.groupsStateByLimiter[requestArgs] = newSingleLimit
	}

	return state.groupsStateByLimiter[requestArgs]
}
