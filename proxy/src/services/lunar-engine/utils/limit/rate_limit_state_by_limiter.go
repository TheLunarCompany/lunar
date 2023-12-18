package limit

import (
	"fmt"
	"lunar/toolkit-core/clock"
	"sync"
	"time"
)

type RateLimitState struct {
	clock                clock.Clock
	groupsStateByLimiter map[string]*groupedRateLimitState
	mutex                sync.Mutex
}

func NewRateLimitState(
	clock clock.Clock,
) *RateLimitState {
	return &RateLimitState{
		clock:                clock,
		groupsStateByLimiter: map[string]*groupedRateLimitState{},
		mutex:                sync.Mutex{},
	}
}

func (state *RateLimitState) Increment(
	requestArgs RequestArguments,
	windowSize time.Duration,
) (int, error) {
	if requestArgs.LimiterID == "" {
		return 0, fmt.Errorf("LimiterID must be specified")
	}
	groupedState := state.getLimiterState(requestArgs.LimiterID)

	counter, err := groupedState.Increment(
		requestArgs.Grouping, requestArgs.GroupID, windowSize)
	if err != nil {
		return 0, err
	}
	return counter, nil
}

func (state *RateLimitState) Counters() map[RequestArguments]int {
	state.mutex.Lock()
	defer state.mutex.Unlock()

	counters := map[RequestArguments]int{}
	for limiterID, groupedState := range state.groupsStateByLimiter {
		for groupID, counter := range groupedState.Counters() {
			requestArgs := RequestArguments{
				LimiterID: limiterID,
				Grouping:  Grouped,
				GroupID:   groupID,
			}
			counters[requestArgs] = counter
		}
		requestArgs := RequestArguments{
			LimiterID: limiterID,
			Grouping:  Ungrouped,
			GroupID:   "",
		}
		counters[requestArgs] = groupedState.defaultRateLimitState.Counter()
	}

	return counters
}

func (state *RateLimitState) getLimiterState(
	limiterID string,
) *groupedRateLimitState {
	state.mutex.Lock()
	defer state.mutex.Unlock()
	if _, found := state.groupsStateByLimiter[limiterID]; !found {
		newState := newGroupedRateLimitState(state.clock)
		state.groupsStateByLimiter[limiterID] = newState
	}
	return state.groupsStateByLimiter[limiterID]
}
