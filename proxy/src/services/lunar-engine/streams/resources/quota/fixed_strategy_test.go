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

func TestMain(m *testing.M) {
	_, cleanup, err := setupMemory()
	if err != nil {
		panic(err)
	}

	// Run the tests
	code := m.Run()

	// cleanup
	if cleanup != nil {
		cleanup()
	}
	// Exit with the code from the tests
	os.Exit(code)
}

func TestFixedWindowsMonthlyRenewal(t *testing.T) {
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

	err = fixedWindow.Inc(APIStreamB)
	assert.Nil(t, err)

	allowed, err = fixedWindow.Allowed(APIStreamB)
	assert.Nil(t, err)
	assert.False(t, allowed)
}
