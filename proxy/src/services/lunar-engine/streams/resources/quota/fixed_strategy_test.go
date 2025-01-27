package quotaresource

import (
	lunarMessages "lunar/engine/messages"
	streamtypes "lunar/engine/streams/types"
	contextmanager "lunar/toolkit-core/context-manager"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

// Useful
var (
	setMemoryTime = func(t time.Time) {}
	cleanup       func()
)

func TestMain(m *testing.M) {
	memorySetup, err := setupMemory()
	if err != nil {
		panic(err)
	}

	setMemoryTime = memorySetup.setTime
	cleanup = memorySetup.cleanup

	// Run the tests
	code := m.Run()

	// cleanup
	if memorySetup.cleanup != nil {
		memorySetup.cleanup()
	}
	// Exit with the code from the tests
	os.Exit(code)
}

func TestFixedWindowsMonthlyRenewal(t *testing.T) {
	cleanup()
	var allowed bool
	var err error
	var fixedWindow ResourceAdmI
	mockClock := contextmanager.Get().SetMockClock().GetMockClock()

	quotaStrategy := &QuotaConfig{
		ID:     "test",
		Filter: nil,
		Strategy: &StrategyConfig{
			FixedWindow: &FixedWindowConfig{
				QuotaLimit: QuotaLimit{
					Max:          1,
					Interval:     10,
					IntervalUnit: "hour",
				},
				MonthlyRenewal: &MonthlyRenewalData{
					Timezone: time.Local.String(),
					Day:      mockClock.Now().Day(),
					Hour:     mockClock.Now().Hour(),
					Minute:   mockClock.Now().Minute() + 1,
				},
			},
		},
	}

	fixedWindow, err = NewFixedStrategy(quotaStrategy, nil)
	assert.Nil(t, err)

	requestA := lunarMessages.OnRequest{ID: "test"}
	requestB := lunarMessages.OnRequest{ID: "test2"}
	APIStreamA := streamtypes.NewRequestAPIStream(requestA)
	APIStreamB := streamtypes.NewRequestAPIStream(requestB)

	err = fixedWindow.Inc(APIStreamA)
	assert.Nil(t, err)

	allowed, err = fixedWindow.Allowed(APIStreamA)
	assert.Nil(t, err)
	assert.True(t, allowed)

	err = fixedWindow.Inc(APIStreamB)
	assert.Nil(t, err)

	allowed, err = fixedWindow.Allowed(APIStreamB)
	assert.Nil(t, err)
	assert.False(t, allowed)

	mockClock.AdvanceTime(1 * time.Minute)
	setMemoryTime(mockClock.Now())

	err = fixedWindow.Inc(APIStreamB)
	assert.Nil(t, err)

	allowed, err = fixedWindow.Allowed(APIStreamB)
	assert.Nil(t, err)
	assert.False(t, allowed)
}

func TestFixedWindowCustomCounterHandlesQuotaByHeaderValue(t *testing.T) {
	cleanup()
	var allowed bool
	var err error
	var fixedWindow ResourceAdmI
	mockClock := contextmanager.Get().SetMockClock().GetMockClock()

	quotaStrategy := &QuotaConfig{
		ID:     "test",
		Filter: nil,
		Strategy: &StrategyConfig{
			FixedWindowCustomCounter: &FixedWindowCustomCounterConfig{
				FixedWindowConfig: FixedWindowConfig{
					QuotaLimit: QuotaLimit{
						Max:          9, // This number is crucial for the test
						Interval:     1,
						IntervalUnit: "minute",
					},
				},
				CounterValuePath: `$.request.headers["x-lunar-used-tokens"]`,
			},
		},
	}

	fixedWindow, err = NewFixedStrategy(quotaStrategy, nil)
	assert.Nil(t, err)

	requestA := lunarMessages.OnRequest{
		ID:      "test1",
		Headers: map[string]string{"x-lunar-used-tokens": "3"},
	}
	requestB := lunarMessages.OnRequest{
		ID:      "test2",
		Headers: map[string]string{"x-lunar-used-tokens": "3"},
	}
	requestC := lunarMessages.OnRequest{
		ID:      "test3",
		Headers: map[string]string{"x-lunar-used-tokens": "4"},
	}
	requestD := lunarMessages.OnRequest{
		ID:      "test4",
		Headers: map[string]string{"x-lunar-used-tokens": "2"},
	}
	APIStreamA := streamtypes.NewRequestAPIStream(requestA)
	APIStreamB := streamtypes.NewRequestAPIStream(requestB)
	APIStreamC := streamtypes.NewRequestAPIStream(requestC)
	APIStreamD := streamtypes.NewRequestAPIStream(requestD)

	// requires 3 tokens, will lower the remaining quota from 9 to 6
	err = fixedWindow.Inc(APIStreamA)
	assert.Nil(t, err)

	allowed, err = fixedWindow.Allowed(APIStreamA)
	assert.Nil(t, err)
	assert.True(t, allowed)

	// requires 3 tokens, will lower the remaining quota from 6 to 3
	err = fixedWindow.Inc(APIStreamB)
	assert.Nil(t, err)

	allowed, err = fixedWindow.Allowed(APIStreamB)
	assert.Nil(t, err)
	assert.True(t, allowed)

	// requires 4 tokens, not enough tokens left for it so quota will not be updated
	err = fixedWindow.Inc(APIStreamC)
	assert.Nil(t, err)

	allowed, err = fixedWindow.Allowed(APIStreamC)
	assert.Nil(t, err)
	assert.False(t, allowed)

	// since the quota is still on 3, this Inc will succeed since it requires 2 tokens so remaining quota will now be 1
	err = fixedWindow.Inc(APIStreamD)
	assert.Nil(t, err)

	// hence request D should be allowed
	allowed, err = fixedWindow.Allowed(APIStreamD)
	assert.Nil(t, err)
	assert.True(t, allowed)

	mockClock.AdvanceTime(10 * time.Minute)
	setMemoryTime(mockClock.Now())

	// since the window has passed, the quota should be reset to 9,
	// so request C, which was not allowed before,
	err = fixedWindow.Inc(APIStreamC)
	assert.Nil(t, err)

	allowed, err = fixedWindow.Allowed(APIStreamC)
	assert.Nil(t, err)
	assert.True(t, allowed)
}
