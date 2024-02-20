package clock

import (
	"sync"
	"time"
)

// MockClock represents a mock clock that only moves forward programmatically.
type MockClock struct {
	now time.Time
	mu  sync.RWMutex

	timers clockTimers // tickers & timers
}

// MockTimer represents a single event.
type MockTimer struct {
	C         <-chan time.Time
	c         chan time.Time
	next      time.Time // next tick time
	mockClock *MockClock
	afterFn   func() // AfterFunc function, optional
	stopped   bool   // true if stopped, false if running
}

// clockTimer represents an object with an associated start time.
type clockTimer interface {
	Next() time.Time
	Tick(time.Time)
}
