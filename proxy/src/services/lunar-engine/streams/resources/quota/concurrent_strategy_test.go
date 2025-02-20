package quotaresource

import (
	lunar_messages "lunar/engine/messages"
	streamtypes "lunar/engine/streams/types"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestConcurrentStrategy(t *testing.T) {
	cleanup()
	var allowed bool
	var err error
	var concurrent ResourceAdmI

	quotaStrategy := &QuotaConfig{
		ID:     "test",
		Filter: nil,
		Strategy: &StrategyConfig{
			Concurrent: &ConcurrentConfig{
				MaxRequestCount: 1,
			},
		},
	}

	concurrent, err = NewConcurrentStrategy(quotaStrategy, nil)
	assert.Nil(t, err)

	requestA := lunar_messages.OnRequest{ID: "test"}
	requestB := lunar_messages.OnRequest{ID: "test2"}
	APIStreamA := streamtypes.NewRequestAPIStream(requestA, sharedState)
	APIStreamB := streamtypes.NewRequestAPIStream(requestB, sharedState)

	err = concurrent.Inc(APIStreamA)
	assert.Nil(t, err)

	allowed, err = concurrent.Allowed(APIStreamA)
	assert.Nil(t, err)
	assert.True(t, allowed)

	err = concurrent.Inc(APIStreamB)
	assert.Nil(t, err)

	allowed, err = concurrent.Allowed(APIStreamB)
	assert.Nil(t, err)
	assert.False(t, allowed)
}
