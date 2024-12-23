package clock

import "time"

func (t *RealClock) Now() time.Time {
	return time.Now()
}

func (t *RealClock) Sleep(d time.Duration) {
	time.Sleep(d)
}

func (t *RealClock) After(d time.Duration) <-chan time.Time {
	return time.After(d)
}

func (t *RealClock) Since(sinceTime time.Time) time.Duration {
	return time.Since(sinceTime)
}

func NewRealClock() *RealClock {
	return &RealClock{}
}
