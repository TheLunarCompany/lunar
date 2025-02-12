package client

import (
	"fmt"
	"lunar/toolkit-core/clock"
	"time"

	"github.com/rs/zerolog/log"
)

type RetryConfig struct {
	Attempts           int
	SleepMillis        int
	WithInitialSleep   bool
	InitialSleepMillis int
	FailedAttemptLog   string
	FailureLog         string
}

func WithRetry[T any](
	clock clock.Clock,
	config *RetryConfig,
	f func() (T, error), //nolint:varnamelen
) (T, error) {
	if config.WithInitialSleep {
		clock.Sleep(time.Duration(config.InitialSleepMillis) * time.Millisecond)
	}
	var err error
	var res T
	for i := 0; i < config.Attempts; i++ {
		res, err = f()
		if err != nil && config.FailedAttemptLog != "" {
			log.Trace().Msgf("%s (error: %s). Attempt %d/%d",
				config.FailedAttemptLog, err, i+1, config.Attempts)
		} else if err == nil {
			return res, nil
		}
		clock.Sleep(time.Duration(config.SleepMillis) * time.Millisecond)
	}

	return res, fmt.Errorf("%s, (error: %s)", config.FailureLog, err)
}
