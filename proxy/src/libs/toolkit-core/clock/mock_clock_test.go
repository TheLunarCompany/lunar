package clock_test

import (
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/testutils"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestWhenSleepIsCalledTimeNowAdvancesAccordingly(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	timeToSleep := 10 * time.Second

	before := clock.Now()
	clock.AdvanceTime(timeToSleep)
	after := clock.Now()

	assert.Equal(t, before.Add(timeToSleep), after)
}

func TestGivenSetupMockTimeIsCalledInParallelTimeWorksAsExpected(t *testing.T) {
	t.Parallel()
	testutils.TestInParallel(t, 100, "TestClock", func(t *testing.T) {
		clock := clock.NewMockClock()
		timeToSleep := 10 * time.Second

		before := clock.Now()
		clock.AdvanceTime(timeToSleep)
		after := clock.Now()

		assert.Equal(t, before.Add(timeToSleep), after)
	})
}
