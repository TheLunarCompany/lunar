package clock

import (
	"sort"
	"time"

	"github.com/rs/zerolog/log"
)

func NewMockClock() *MockClock {
	//nolint:exhaustruct
	return &MockClock{now: time.Now()}
}

// Now returns the current wall time on the mock clock.
func (m *MockClock) Now() time.Time {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.now
}

// Sleep pauses the goroutine for the given duration on the mock clock.
// The clock must be moved forward in a separate goroutine.
func (m *MockClock) Sleep(duration time.Duration) {
	<-m.After(duration)
}

// Since returns time since `sinceTime` using the mock clock's wall time.
func (m *MockClock) Since(sinceTime time.Time) time.Duration {
	return m.Now().Sub(sinceTime)
}

// Until returns time until `untilTime` using the mock clock's wall time.
func (m *MockClock) Until(untilTime time.Time) time.Duration {
	return untilTime.Sub(m.Now())
}

// After waits for the duration to elapse and then sends the current time
// on the returned channel.
func (m *MockClock) After(duration time.Duration) <-chan time.Time {
	return m.MockTimer(duration).C
}

// AfterFunc waits for the duration to elapse and then executes a function
// in its own goroutine. A Timer is returned that can be stopped.
func (m *MockClock) AfterFunc(duration time.Duration, callback func()) *MockTimer {
	m.mu.Lock()
	defer m.mu.Unlock()
	ch := make(chan time.Time, 1)

	//nolint:exhaustruct
	mockTimer := &MockTimer{
		c:         ch,
		afterFn:   callback,
		mockClock: m,
		next:      m.now.Add(duration),
		stopped:   false,
	}
	m.timers = append(m.timers, mockTimer)
	return mockTimer
}

// AdvanceTime moves the current time of the MockClock forward
// by the specified duration.
// This should only be called from a single goroutine at a time.
func (m *MockClock) AdvanceTime(duration time.Duration) {
	log.Debug().Msgf("MockClock: AdvanceTime() called with duration %s", duration)

	// Calculate the final current time.
	finalTime := m.Now().Add(duration)

	// Continue to execute timers until there are no more before the new time.
	for m.runNextTimer(finalTime) {
	}

	// update new time.
	m.mu.Lock()
	m.now = finalTime
	m.mu.Unlock()

	// Ensures that after the mock clock's time has been advanced and
	// any immediate timers have been executed, the program momentarily pauses.
	// This pause allows other goroutines, which might be waiting for these time
	// changes to trigger their own logic, to run.
	// Without this call, there's a risk that the current goroutine could continue
	// executing its next instructions without giving other goroutines a chance to
	// respond to the time change.
	gosched()
}

// WaitForAllTimers sets the clock until all timers are expired
func (m *MockClock) WaitForAllTimers() time.Time {
	// Continue to execute timers until there are no more
	for {
		m.mu.Lock()
		if len(m.timers) == 0 {
			m.mu.Unlock()
			return m.Now()
		}

		sort.Sort(m.timers)
		next := m.timers[len(m.timers)-1].Next()
		m.mu.Unlock()
		m.Set(next)
	}
}

// Set sets the current time of the mock clock to a specific one.
// This should only be called from a single goroutine at a time.
func (m *MockClock) Set(setTime time.Time) {
	// Continue to execute timers until there are no more before the new time.
	for m.runNextTimer(setTime) {
	}

	m.mu.Lock()
	m.now = setTime
	m.mu.Unlock()

	// make sure other goroutines get handled.
	gosched()
}

// MockTimer creates a new instance of MockTimer.
func (m *MockClock) MockTimer(duration time.Duration) *MockTimer {
	m.mu.Lock()
	ch := make(chan time.Time, 1)
	//nolint:exhaustruct
	mockTimer := &MockTimer{
		C:         ch,
		c:         ch,
		mockClock: m,
		next:      m.now.Add(duration),
		stopped:   false,
	}
	m.timers = append(m.timers, mockTimer)
	now := m.now
	m.mu.Unlock()

	m.runNextTimer(now)
	return mockTimer
}

// removeClockTimer removes a timer from m.timers.
// Method isn't thread safe - caller MUST lock m.mu
func (m *MockClock) removeClockTimer(clockTimer clockTimer) {
	for i, timer := range m.timers {
		if timer == clockTimer {
			copy(m.timers[i:], m.timers[i+1:])
			m.timers[len(m.timers)-1] = nil
			m.timers = m.timers[:len(m.timers)-1]
			break
		}
	}
	sort.Sort(m.timers)
}

// runNextTimer executes the next timer in chronological order and moves the
// current time to the timer's next tick time. The next time is not executed if
// its next time is after the max time. Returns true if a timer was executed.
func (m *MockClock) runNextTimer(maxTime time.Time) bool {
	m.mu.Lock()

	// Sort timers by time.
	sort.Sort(m.timers)

	// If we have no more timers then exit.
	if len(m.timers) == 0 {
		m.mu.Unlock()
		return false
	}

	// Retrieve next timer. Exit if next tick is after new time.
	nextTimer := m.timers[0]
	if nextTimer.Next().After(maxTime) {
		m.mu.Unlock()
		return false
	}

	// Move "now" forward and unlock clock.
	m.now = nextTimer.Next()
	now := m.now
	m.mu.Unlock()

	// Execute timer.
	nextTimer.Tick(now)
	return true
}

// clockTimers represents a list of sortable timers.
type clockTimers []clockTimer

// methods for sorting
func (a clockTimers) Len() int      { return len(a) }
func (a clockTimers) Swap(i, j int) { a[i], a[j] = a[j], a[i] }
func (a clockTimers) Less(i, j int) bool {
	return a[i].Next().Before(a[j].Next())
}

func (t *MockTimer) Next() time.Time { return t.next }
func (t *MockTimer) Tick(now time.Time) {
	// a gosched() after ticking, to allow any consequences of the
	// tick to complete
	defer gosched()

	t.mockClock.mu.Lock()
	if t.afterFn != nil {
		// defer function execution until the lock is released, and
		defer func() { go t.afterFn() }()
	} else {
		t.c <- now
	}
	t.mockClock.removeClockTimer(t)
	t.stopped = true
	t.mockClock.mu.Unlock()
}

// Stop turns off the ticker.
func (t *MockTimer) Stop() bool {
	t.mockClock.mu.Lock()
	registered := !t.stopped
	t.mockClock.removeClockTimer(t)
	t.stopped = true
	t.mockClock.mu.Unlock()

	return registered
}

// Reset changes the expiry time of the timer
func (t *MockTimer) Reset(duration time.Duration) bool {
	t.mockClock.mu.Lock()
	t.next = t.mockClock.now.Add(duration)
	defer t.mockClock.mu.Unlock()

	registered := !t.stopped
	if t.stopped {
		t.mockClock.timers = append(t.mockClock.timers, (t))
	}

	t.stopped = false
	return registered
}

// gosched yields control to the Go scheduler
func gosched() { time.Sleep(1 * time.Millisecond) }
