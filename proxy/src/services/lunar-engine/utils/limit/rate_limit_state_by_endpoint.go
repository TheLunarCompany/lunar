package limit

import (
	"fmt"
	"lunar/engine/config"
	"lunar/engine/utils"
	"lunar/toolkit-core/clock"
	"sync"
	"time"
)

type RateLimitStateByEndpoint struct {
	clock                   clock.Clock
	globalRateLimitState    *groupedRateLimitState
	endpointRateLimitStates map[config.Endpoint]*groupedRateLimitState
	mutex                   sync.Mutex
}

func NewRateLimitStateByEndpoint(
	clock clock.Clock,
) *RateLimitStateByEndpoint {
	return &RateLimitStateByEndpoint{
		clock:                   clock,
		globalRateLimitState:    newGroupedRateLimitState(clock),
		endpointRateLimitStates: map[config.Endpoint]*groupedRateLimitState{},
		mutex:                   sync.Mutex{},
	}
}

func (state *RateLimitStateByEndpoint) Increment(
	requestArgs RequestArguments,
	windowSize time.Duration,
) (int, error) {
	var groupedState *groupedRateLimitState
	switch requestArgs.RequestScope {

	case utils.ScopeGlobal:
		groupedState = state.globalRateLimitState
	case utils.ScopeEndpoint:
		if requestArgs.Method == "" || requestArgs.NormalizedURL == "" {
			return 0, fmt.Errorf(
				"Method and NormalizedURL must be specified for endpoint scope")
		}
		endpoint := config.Endpoint{
			Method: requestArgs.Method,
			URL:    requestArgs.NormalizedURL,
		}
		groupedState = state.getEndpointState(endpoint)

	}

	counter, err := groupedState.Increment(
		requestArgs.Grouping, requestArgs.GroupID, windowSize)
	if err != nil {
		return 0, err
	}
	return counter, nil
}

func (state *RateLimitStateByEndpoint) getEndpointState(
	endpoint config.Endpoint,
) *groupedRateLimitState {
	state.mutex.Lock()
	defer state.mutex.Unlock()
	if _, found := state.endpointRateLimitStates[endpoint]; !found {
		newState := newGroupedRateLimitState(state.clock)
		state.endpointRateLimitStates[endpoint] = newState
	}
	return state.endpointRateLimitStates[endpoint]
}
