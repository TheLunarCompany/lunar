package clock

import "time"

type Clock interface {
	Now() time.Time
	Sleep(d time.Duration)
	After(d time.Duration) <-chan time.Time
	Since(sinceTime time.Time) time.Duration
	Until(untilTime time.Time) time.Duration
}

type RealClock struct{}
