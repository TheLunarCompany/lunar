package concurrency_test

import (
	"lunar/engine/utils/limit/concurrency"
	"lunar/toolkit-core/clock"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestItAllowsTakingSlotsUntilThereAreNoneLeft(t *testing.T) {
	t.Parallel()
	concurrencyLimit := 2
	ttl := 80 * time.Millisecond
	vacuumTick := 10 * time.Millisecond
	clock := clock.NewMockClock()
	limiter := concurrency.NewLimiter(concurrencyLimit, ttl, vacuumTick, clock)
	respA := limiter.TryTakeSlot("a")
	assert.True(t, respA)

	respB := limiter.TryTakeSlot("b")
	assert.True(t, respB)

	respC := limiter.TryTakeSlot("c")
	assert.False(t, respC)
}

func TestItAllowsTakingSlotsAfterPreviousSlotWasReleased(t *testing.T) {
	t.Parallel()
	concurrencyLimit := 2
	ttl := 80 * time.Millisecond
	vacuumTick := 10 * time.Millisecond
	clock := clock.NewMockClock()
	limiter := concurrency.NewLimiter(concurrencyLimit, ttl, vacuumTick, clock)
	respA := limiter.TryTakeSlot("a")
	assert.True(t, respA)

	respB := limiter.TryTakeSlot("b")
	assert.True(t, respB)

	limiter.ReleaseSlot("b")

	respC := limiter.TryTakeSlot("c")
	assert.True(t, respC)
}

func TestItDoesntTakeSlotTwiceForSameID(t *testing.T) {
	t.Parallel()
	concurrencyLimit := 2
	ttl := 80 * time.Millisecond
	vacuumTick := 10 * time.Millisecond
	clock := clock.NewMockClock()
	limiter := concurrency.NewLimiter(concurrencyLimit, ttl, vacuumTick, clock)
	respA := limiter.TryTakeSlot("a")
	assert.True(t, respA)

	// "a" is taken a second time - which in fact does nothing
	respA2 := limiter.TryTakeSlot("a")
	assert.True(t, respA2)

	// since this is actually the 2nd TryTakeSlot attempt, it will return true
	respB := limiter.TryTakeSlot("b")
	assert.True(t, respB)
}

func TestItDoesntReleaseTwiceForSameID(t *testing.T) {
	t.Parallel()
	concurrencyLimit := 2
	ttl := 80 * time.Millisecond
	vacuumTick := 10 * time.Millisecond
	clock := clock.NewMockClock()
	limiter := concurrency.NewLimiter(concurrencyLimit, ttl, vacuumTick, clock)
	respA := limiter.TryTakeSlot("a")
	assert.True(t, respA)

	respB := limiter.TryTakeSlot("b")
	assert.True(t, respB)

	// 2 releases for the same ID
	limiter.ReleaseSlot("b")
	limiter.ReleaseSlot("b")

	// one slot is now available
	respC := limiter.TryTakeSlot("c")
	assert.True(t, respC)

	// but only one :)
	respD := limiter.TryTakeSlot("d")
	assert.False(t, respD)
}

func TestItAutomaticallyReleasesSlotAfterTimeout(t *testing.T) {
	t.Parallel()
	concurrencyLimit := 1
	ttl := 80 * time.Millisecond
	vacuumTick := 10 * time.Millisecond
	clock := clock.NewMockClock()
	limiter := concurrency.NewLimiter(concurrencyLimit, ttl, vacuumTick, clock)
	respA := limiter.TryTakeSlot("a")
	assert.True(t, respA)

	respB := limiter.TryTakeSlot("b")
	assert.False(t, respB)

	clock.AdvanceTime(ttl + 1)
	time.Sleep(1 * time.Millisecond)
}
