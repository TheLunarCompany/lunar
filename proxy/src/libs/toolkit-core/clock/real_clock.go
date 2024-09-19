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

func NewRealClock() *RealClock {
	return &RealClock{}
}
