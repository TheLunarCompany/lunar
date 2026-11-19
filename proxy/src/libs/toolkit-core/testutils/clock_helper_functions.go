package testutils

import (
	"lunar/toolkit-core/clock"
	"time"
)

func PlusEpsilon(timeToWait time.Duration) time.Duration {
	epsilon := 1 * time.Nanosecond
	return timeToWait + epsilon
}

func AdvanceTimeInBackground(
	clock *clock.MockClock,
	times int,
	tick time.Duration,
) {
	go func() {
		for i := 0; i < times; i++ {
			time.Sleep(1 * time.Millisecond)
			clock.AdvanceTime(tick)
		}
	}()
}
