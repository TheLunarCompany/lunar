package client_test

import (
	"fmt"
	"lunar/toolkit-core/client"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/testutils"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestWithRetryReturnsValueWhenSucceeds(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	config := client.RetryConfig{
		Attempts:    3,
		SleepMillis: 1,
	}
	var counter int
	f := func() (bool, error) {
		counter++
		if counter < 1 {
			return false, fmt.Errorf("still not there")
		}
		return true, nil
	}
	res, err := client.WithRetry(clock, &config, f)
	assert.Nil(t, err)
	assert.Equal(t, res, true)
}

func TestWithRetryReturnsValueWhenFails(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	config := client.RetryConfig{
		Attempts:    3,
		SleepMillis: 50,
	}
	want := false
	f := func() (bool, error) {
		return want, fmt.Errorf("won't ever get away from that error")
	}

	var res bool
	var err error

	testutils.AdvanceTimeInBackground(
		clock,
		config.Attempts,
		time.Duration(config.SleepMillis+1)*time.Millisecond,
	)

	res, err = client.WithRetry(clock, &config, f)

	assert.Error(t, err)
	assert.Equal(t, res, want)
}
