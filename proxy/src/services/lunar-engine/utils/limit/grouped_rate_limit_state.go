package limit

import (
	"fmt"
	"lunar/toolkit-core/clock"
	"sync"
	"time"
)

type (
	Grouping int
	GroupID  = string
)

const (
	Grouped Grouping = iota
	Ungrouped
)

type groupedRateLimitState struct {
	clock                 clock.Clock
	defaultRateLimitState *singleRateLimitState
	groupedRateLimitState map[GroupID]*singleRateLimitState
	mutex                 sync.RWMutex
}

func newGroupedRateLimitState(clock clock.Clock) *groupedRateLimitState {
	return &groupedRateLimitState{
		clock:                 clock,
		defaultRateLimitState: newSingleRateLimitState(clock),
		groupedRateLimitState: map[GroupID]*singleRateLimitState{},
		mutex:                 sync.RWMutex{},
	}
}

func (state *groupedRateLimitState) Increment(
	groupType Grouping,
	groupID GroupID,
	windowSize time.Duration,
) (int, error) {
	var counter int
	switch groupType {
	case Grouped:
		if groupID == "" {
			return 0, fmt.Errorf("GroupID must be specified for a grouped state")
		}
		counter = state.getGroupedState(groupID).Increment(windowSize)
	case Ungrouped:
		counter = state.defaultRateLimitState.Increment(windowSize)
	}

	return counter, nil
}

func (state *groupedRateLimitState) Counters() map[GroupID]int {
	state.mutex.RLock()
	defer state.mutex.RUnlock()

	counters := map[GroupID]int{}
	for groupID, groupedState := range state.groupedRateLimitState {
		counters[groupID] = groupedState.Counter()
	}

	return counters
}

func (state *groupedRateLimitState) getGroupedState(
	groupID GroupID,
) *singleRateLimitState {
	state.mutex.Lock()
	defer state.mutex.Unlock()
	if _, found := state.groupedRateLimitState[groupID]; !found {
		newState := newSingleRateLimitState(state.clock)
		state.groupedRateLimitState[groupID] = newState
	}
	return state.groupedRateLimitState[groupID]
}
