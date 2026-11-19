package failsafe

import (
	"lunar/toolkit-core/clock"
	"time"

	"github.com/rs/zerolog"
)

type Config struct {
	ObtainPredicate     func() bool
	OnChangeToTrue      func()
	OnChangeToFalse     func()
	StateTrueName       string
	StateFalseName      string
	MinTimeBetweenCalls time.Duration
	ConsecutiveN        int           // Number of consecutive confirmations needed
	MinStablePeriod     time.Duration // Minimum time period for stability
	CooldownPeriod      time.Duration // Cooldown period after a change to false
}

// StateChangeWatcher is a component that watches a boolean state and triggers
// change functions when the state changes and is stable.
// This component assumes that the underlying boolean state represents "healthy"
// as true and "unhealthy" as false.
// Thus after a change to false, the cooldown period is started.
// Change functions are available for both directions.
// Change is only considered stable after a minimum stable period and a minimum number of
// consecutive confirmations.
type StateChangeWatcher struct {
	clock              clock.Clock
	config             Config
	lastRunAt          time.Time
	lastState          bool
	changeCount        int
	changeStart        time.Time
	changeTriggered    bool
	currentStableState bool
	logger             zerolog.Logger
}

func NewStateChangeWatcher(
	name string,
	config Config,
	clock clock.Clock,
	logger zerolog.Logger,
) *StateChangeWatcher {
	return &StateChangeWatcher{
		clock:              clock,
		config:             config,
		lastState:          true, // The initial state is assumed to be healthy
		currentStableState: true, // The initial state is assumed to be healthy
		changeCount:        0,
		logger: logger.With().
			Str("component", "StateChangeWatcher").
			Str("name", name).
			Logger(),
	}
}

func (scw *StateChangeWatcher) RunInBackground() {
	go scw.run()
}

func (scw *StateChangeWatcher) getStateName(state bool) string {
	if state {
		if scw.config.StateTrueName == "" {
			return "true"
		}
		return scw.config.StateTrueName
	}
	if scw.config.StateFalseName == "" {
		return "false"
	}
	return scw.config.StateFalseName
}

func (scw *StateChangeWatcher) run() {
	for {
		timeSinceLastRun := scw.clock.Since(scw.lastRunAt)
		timeToWait := scw.config.MinTimeBetweenCalls - timeSinceLastRun
		if timeToWait > 0 {
			scw.logger.Trace().
				Str("last-state", scw.getStateName(scw.lastState)).
				Msgf("Waiting for %s before next run", timeToWait) // TRACE
			<-scw.clock.After(timeToWait)
		}

		currentState := scw.config.ObtainPredicate()

		// Check if the state has changed
		if currentState != scw.lastState {
			// State changed, reset the count and set the change timer to now
			scw.logger.Debug().
				Msgf("Obtained state %s while current stable state is %s, "+
					"ensuring change is stable before acting",
					scw.getStateName(currentState), scw.getStateName(scw.lastState))

			scw.changeCount = 1
			scw.changeStart = scw.clock.Now()
			scw.changeTriggered = false
		} else {
			// Increment the consecutive count
			scw.changeCount++
			// Check if there have enough consecutive confirmations
			if scw.changeCount >= scw.config.ConsecutiveN {
				// Check if the state has been stable for the minimum required period
				if scw.clock.Since(scw.changeStart) >= scw.config.MinStablePeriod {
					// Check if the change function has already been triggered for this state change
					if !scw.changeTriggered && currentState != scw.currentStableState {
						scw.logger.Debug().
							Int("changeCount", scw.changeCount).
							Msgf("State change detected as stable - state is now %s. "+
								"Triggering change function for new stable state", scw.getStateName(currentState))
						// Trigger the change function based on the current state
						if currentState {
							scw.config.OnChangeToTrue()
						} else {
							scw.config.OnChangeToFalse()
							scw.logger.Warn().Msgf("State detected as unhealthy, entering cooldown for %v",
								scw.config.CooldownPeriod)
							scw.clock.Sleep(scw.config.CooldownPeriod)
							scw.logger.Info().Msg("Cooldown ended")
						}
						scw.currentStableState = currentState
						scw.changeTriggered = true
					}
				}
			}
		}

		// Update the last state and run time
		scw.lastState = currentState
		scw.lastRunAt = scw.clock.Now()
	}
}
