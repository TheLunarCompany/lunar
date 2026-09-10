package quotaresource

import (
	lunar_messages "lunar/engine/messages"
	streamtypes "lunar/engine/streams/types"
	context_manager "lunar/toolkit-core/context-manager"
	lunar_cluster "lunar/toolkit-core/network/lunar-cluster"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConcurrentStrategy(t *testing.T) {
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
	require.NoError(t, err)

	requestA := lunar_messages.OnRequest{ID: "test"}
	requestB := lunar_messages.OnRequest{ID: "test2"}
	APIStreamA := streamtypes.NewRequestAPIStream(requestA, sharedState)
	APIStreamB := streamtypes.NewRequestAPIStream(requestB, sharedState)

	err = concurrent.Inc(APIStreamA)
	require.NoError(t, err)

	allowed, err = concurrent.Allowed(APIStreamA)
	require.NoError(t, err)
	assert.True(t, allowed)

	err = concurrent.Inc(APIStreamB)
	require.NoError(t, err)

	allowed, err = concurrent.Allowed(APIStreamB)
	require.NoError(t, err)
	assert.False(t, allowed)
}

func TestExpiredRequestAreRemoved(t *testing.T) {
	ctxMng := context_manager.Get().SetMockClock()
	clock := ctxMng.GetMockClock()
	expiryTime := 1 * time.Second
	var allowed bool
	var err error
	var concurrent ResourceAdmI

	quotaStrategy := &QuotaConfig{
		ID:     "TestExpired",
		Filter: nil,
		Strategy: &StrategyConfig{
			Concurrent: &ConcurrentConfig{
				MaxRequestCount:      1,
				RequestExpirationSec: int64(expiryTime.Seconds()),
				GCIntervalSec:        int64(expiryTime.Seconds()),
			},
		},
	}

	concurrent, err = NewConcurrentStrategy(quotaStrategy, nil)
	require.NoError(t, err)

	requestA := lunar_messages.OnRequest{ID: "TestExpiredRequestAreRemoved"}
	requestB := lunar_messages.OnRequest{ID: "TestExpiredRequestAreRemoved2"}
	APIStreamA := streamtypes.NewRequestAPIStream(requestA, sharedState)
	APIStreamB := streamtypes.NewRequestAPIStream(requestB, sharedState)

	err = concurrent.Inc(APIStreamA)
	require.NoError(t, err)

	allowed, err = concurrent.Allowed(APIStreamA)
	require.NoError(t, err)
	assert.True(t, allowed)

	// We use the default expiry time and add 10 seconds to it
	clock.AdvanceTime(expiryTime + 10*time.Second)
	clock.Set(clock.Now().Add(expiryTime + 10*time.Second))

	err = concurrent.Inc(APIStreamB)
	require.NoError(t, err)

	allowed, err = concurrent.Allowed(APIStreamB)
	require.NoError(t, err)
	assert.True(t, allowed)
}

func TestClusterRequestAreRemoved(t *testing.T) {
	if getBuildTag() == "free" {
		t.Skip("Skipping test in free build")
	}

	ctxMng := context_manager.Get().SetMockClock()
	clock := ctxMng.GetMockClock()
	var expiryTime int
	var gcInterval int
	var clusterStaleThreshold int
	var allowed bool
	var concurrent ResourceAdmI
	var concurrent2 ResourceAdmI

	// We set the expiry time to 2 minutes has we want to check the cluster cleanup
	expiryTime = 120
	gcInterval = 1
	clusterStaleThreshold = 10

	quotaStrategy := &QuotaConfig{
		ID:     "TestClusterExpired",
		Filter: nil,
		Strategy: &StrategyConfig{
			Concurrent: &ConcurrentConfig{
				MaxRequestCount:      1,
				RequestExpirationSec: int64(expiryTime),
				GCIntervalSec:        int64(gcInterval),
			},
		},
	}
	clusterA := "TestCluster"
	clusterB := "TestCluster2"

	lunarCluster, err := lunar_cluster.NewLunarCluster(clusterA)
	require.NoError(t, err)
	ctxMng.WithClusterLiveness(lunarCluster)
	concurrent, err = NewConcurrentStrategy(quotaStrategy, nil)
	require.NoError(t, err)

	lunarCluster2, err := lunar_cluster.NewLunarCluster(clusterB)
	require.NoError(t, err)
	ctxMng.WithClusterLiveness(lunarCluster2)
	concurrent2, err = NewConcurrentStrategy(quotaStrategy, nil)
	require.NoError(t, err)

	requestA := lunar_messages.OnRequest{ID: "TestClusterRequestAreRemoved"}
	requestB := lunar_messages.OnRequest{ID: "TestClusterRequestAreRemoved2"}
	APIStreamA := streamtypes.NewRequestAPIStream(requestA, sharedState)
	APIStreamB := streamtypes.NewRequestAPIStream(requestB, sharedState)

	err = concurrent.Inc(APIStreamA)
	require.NoError(t, err)

	allowed, err = concurrent.Allowed(APIStreamA)
	require.NoError(t, err)
	assert.True(t, allowed)

	err = concurrent2.Inc(APIStreamB)
	require.NoError(t, err)

	clock.AdvanceTime(time.Duration(1 * time.Second))
	clock.Set(clock.Now().Add(time.Duration(1 * time.Second)))

	// Request should be allowed as the cluster is not stale
	allowed, err = concurrent2.Allowed(APIStreamB)
	require.NoError(t, err)
	assert.False(t, allowed)

	err = concurrent2.Dec(APIStreamB)
	require.NoError(t, err)

	clock.AdvanceTime(time.Duration(1 * time.Second))
	clock.Set(clock.Now().Add(time.Duration(1 * time.Second)))

	// We advance the time to make the cluster stale
	lunarCluster.Stop()

	clock.AdvanceTime(time.Duration(clusterStaleThreshold+20) * time.Second)
	clock.Set(clock.Now().Add(time.Duration(clusterStaleThreshold+20) * time.Second))

	err = concurrent2.Inc(APIStreamB)
	require.NoError(t, err)

	allowed, err = concurrent2.Allowed(APIStreamB)
	require.NoError(t, err)
	assert.True(t, allowed)
}
