package clock

import "time"

func (t *RealClock) Now() time.Time {
	return time.Now()
}

func (t *RealClock) Sleep(d time.Duration) {
	time.Sleep(d)
}

func NewRealClock() *RealClock {
	return &RealClock{}
}
