package clock

import "time"

type Clock interface {
	Now() time.Time
	Sleep(d time.Duration)
}

type RealClock struct{}
