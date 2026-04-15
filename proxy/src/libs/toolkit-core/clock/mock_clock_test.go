package clock_test

import (
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/testutils"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

type counter struct {
	count uint32
}

func (c *counter) incr() {
	atomic.AddUint32(&c.count, 1)
}

func (c *counter) get() uint32 {
	return atomic.LoadUint32(&c.count)
}

func TestWhenSleepIsCalledTimeNowAdvancesAccordingly(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	timeToSleep := 10 * time.Second

	before := clock.Now()
	clock.AdvanceTime(timeToSleep)
	after := clock.Now()

	require.Equal(t, before.Add(timeToSleep), after)
}

func TestGivenSetupMockTimeIsCalledInParallelTimeWorksAsExpected(t *testing.T) {
	t.Parallel()
	testutils.TestInParallel(t, 100, "TestClock", func(t *testing.T) {
		clock := clock.NewMockClock()
		timeToSleep := 10 * time.Second

		before := clock.Now()
		clock.AdvanceTime(timeToSleep)
		after := clock.Now()

		require.Equal(t, before.Add(timeToSleep), after)
	})
}

// Ensure that the mock's After channel sends at the correct time.
func TestMockClockAfter(t *testing.T) {
	var resOk int32
	clock := clock.NewMockClock()

	// Create a channel to execute after 10 mock seconds.
	ch := clock.After(10 * time.Second)
	go func(ch <-chan time.Time) {
		<-ch
		atomic.StoreInt32(&resOk, 1)
	}(ch)

	// Move clock forward to just before the time.
	clock.AdvanceTime(9 * time.Second)
	if atomic.LoadInt32(&resOk) == 1 {
		t.Fatal("too early")
	}

	// Move clock forward to the after channel's time.
	clock.AdvanceTime(1 * time.Second)
	if atomic.LoadInt32(&resOk) == 0 {
		require.Fail(t, "too late")
	}
	require.Equal(t, int32(1), resOk)
}

// Ensure that the mock's After channel doesn't block on write.
func TestMockClockUnusedAfter(t *testing.T) {
	mock := clock.NewMockClock()
	mock.After(1 * time.Millisecond)

	done := make(chan bool, 1)
	go func() {
		mock.AdvanceTime(1 * time.Second)
		done <- true
	}()

	select {
	case <-done:
	case <-time.After(1 * time.Second):
		require.Fail(t, "MockClock.AdvanceTime hung")
	}
}

func TestMockClockSince(t *testing.T) {
	clock := clock.NewMockClock()

	beginning := clock.Now()
	clock.AdvanceTime(500 * time.Second)
	require.Equal(t,
		float64(500),
		clock.Since(beginning).Seconds(),
		"unexpected since value")
}

func TestMockClockUntil(t *testing.T) {
	clock := clock.NewMockClock()

	end := clock.Now().Add(500 * time.Second)
	require.Equal(t,
		float64(500),
		clock.Until(end).Seconds(),
		"unexpected duration between `clock` and `end`")

	clock.AdvanceTime(100 * time.Second)
	require.Equal(t,
		float64(400),
		clock.Until(end).Seconds(),
		"unexpected duration between `clock` and `end`")
}

// Ensure that the mock can sleep for the correct time.
func TestMockClockSleep(t *testing.T) {
	var okRes int32
	clock := clock.NewMockClock()

	// Create a channel to execute after 10 mock seconds.
	go func() {
		clock.Sleep(10 * time.Second)
		atomic.StoreInt32(&okRes, 1)
	}()
	gosched()

	// Move clock forward to just before the sleep duration.
	clock.AdvanceTime(9 * time.Second)
	require.Equal(t, int32(0), atomic.LoadInt32(&okRes), "too early")

	// Move clock forward to after the sleep duration.
	clock.AdvanceTime(1 * time.Second)
	require.Equal(t, int32(1), atomic.LoadInt32(&okRes), "too late")
}

func TestMockTimer(t *testing.T) {
	// Create a new mock clock.
	clock := clock.NewMockClock()
	var count counter

	ready := make(chan struct{})
	// Increment count after a mock second.
	go func() {
		timer := clock.MockTimer(1 * time.Second)
		close(ready)
		<-timer.C
		count.incr()
	}()
	<-ready

	// Move the clock forward 10 seconds and test the new value.
	clock.AdvanceTime(10 * time.Second)

	require.Equal(t, uint32(1), count.get())
}

func TestClockNegativeDuration(t *testing.T) {
	clock := clock.NewMockClock()
	timer := clock.MockTimer(-time.Second)
	select {
	case <-timer.C:
	default:
		t.Fatal("timer should have fired immediately")
	}
}

// Ensure that the mock's AfterFunc executes at the correct time.
func TestMockClockAfterFunc(t *testing.T) {
	var okRes int32
	clock := clock.NewMockClock()

	// Execute function after duration.
	clock.AfterFunc(10*time.Second, func() {
		atomic.StoreInt32(&okRes, 1)
	})

	// Move clock forward to just before the time.
	clock.AdvanceTime(9 * time.Second)
	require.Equal(t, int32(0), atomic.LoadInt32(&okRes), "too early")

	// Move clock forward to the after channel's time.
	clock.AdvanceTime(1 * time.Second)
	require.Equal(t, int32(1), atomic.LoadInt32(&okRes), "too late")
}

// Ensure that the mock's AfterFunc doesn't execute if stopped.
func TestMockClockAfterFuncStop(t *testing.T) {
	clock := clock.NewMockClock()

	// Execute function after duration.
	timer := clock.AfterFunc(10*time.Second, func() {
		t.Fatal("unexpected function execution")
	})
	gosched()

	// Stop timer & move clock forward.
	timer.Stop()
	clock.AdvanceTime(10 * time.Second)
	gosched()
}

func gosched() { time.Sleep(1 * time.Millisecond) }
