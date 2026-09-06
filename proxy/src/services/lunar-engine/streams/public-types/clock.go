package publictypes

import "time"

type ClockI interface {
	Now() time.Time
	Sleep(d time.Duration)
	After(d time.Duration) <-chan time.Time
	Since(t time.Time) time.Duration
	Until(t time.Time) time.Duration
}
