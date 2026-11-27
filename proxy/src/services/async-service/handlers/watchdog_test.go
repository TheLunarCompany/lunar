//go:build pro

package handlers

import (
	"lunar/async-service/config"
	"lunar/engine/utils/environment"
	context_manager "lunar/toolkit-core/context-manager"
	protocol_async "lunar/toolkit-core/network/protocols/async"
	redis_client "lunar/toolkit-core/redis-client"
	"os"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

type memorySetup struct {
	client  *redis.Client
	cleanup func()
	setTime func(time.Time)
}

var (
	setMemoryTime = func(_ time.Time) {}
	cleanup       func()
)

func TestMain(m *testing.M) {
	setup, err := setupMemory()
	if err != nil {
		panic(err)
	}

	setMemoryTime = setup.setTime
	cleanup = setup.cleanup

	// Run the tests
	code := m.Run()

	// cleanup
	if setup.cleanup != nil {
		setup.cleanup()
	}
	// Exit with the code from the tests
	os.Exit(code)
}

func TestAsyncListener_UnregisteredRequestMoveBackToIdleQueue(t *testing.T) {
	clock := context_manager.Get().SetMockClock().GetMockClock()
	testID := "TestAsyncListener_UnregisteredRequestMoveBackToIdleQueue"
	asyncQueueKey := redis_client.NewKey()
	asyncQueueKey = asyncQueueKey.Append(redis_client.UnhashedKeyPart("testQueue"))
	asyncQueueKey = asyncQueueKey.Append(redis_client.HashedKeyPart(testID))

	protocol, err := protocol_async.NewProtocol(testID)
	if err != nil {
		t.Fatalf("Failed to create protocol: %v", err)
	}
	watchDog := NewWatchdog(protocol)
	require.NotNil(t, watchDog)
	defer watchDog.Stop()

	asyncReq, err := protocol_async.NewAsyncRequestData(&testID, nil)
	require.NoError(t, err)
	require.True(t, asyncReq.Initialized)

	err = protocol.RegisterEngineQueueKey(asyncQueueKey)
	require.NoError(t, err)

	err = protocol.AddRequestToPendingQueue(asyncReq)
	require.NoError(t, err)

	watchDog.Start()

	setMemoryTime(clock.Now().Add(2 * time.Second))
	clock.Set(clock.Now().Add(2 * time.Second))

	reqInQueue := protocol_async.QueueUnknown
	for i := 0; i < 5; i++ {
		time.Sleep(1 * time.Second)
		reqInQueue, err = protocol.FindRequest(asyncReq)
		require.NoError(t, err)
		if reqInQueue == protocol_async.QueueIdle {
			break
		}
	}

	require.Equal(t, protocol_async.QueueIdle, reqInQueue)
}

func setupMemory() (memorySetup, error) {
	srv, err := miniredis.Run()
	if err != nil {
		return memorySetup{}, err
	}

	client := redis.NewClient(&redis.Options{
		Addr: srv.Addr(),
	})
	prevIdleTime := os.Getenv(config.AsyncServiceIdleSecEnvKey)
	_ = os.Setenv(config.AsyncServiceIdleSecEnvKey, "0")
	prevRedisURL := environment.SetRedisURL("redis://" + client.Options().Addr)
	prevUseRedisCluster := environment.SetRedisUseCluster(false)
	prevRedisOLRetryAttempts := environment.SetRedisMaxOLRetryAttempts(50)
	prevRedisMaxRetryAttempts := environment.SetRedisMaxRetryAttempts(10)
	prevRedisRetryBackoffTime := environment.SetRedisRetryBackoffTime(50)

	cleanup := func() {
		client.FlushAll(srv.Ctx)
		srv.Close()
		_ = os.Setenv(config.AsyncServiceIdleSecEnvKey, prevIdleTime)
		environment.SetRedisURL(prevRedisURL)
		environment.SetRedisUseCluster(prevUseRedisCluster)
		environment.SetRedisMaxOLRetryAttempts(prevRedisOLRetryAttempts)
		environment.SetRedisMaxRetryAttempts(prevRedisMaxRetryAttempts)
		environment.SetRedisRetryBackoffTime(prevRedisRetryBackoffTime)
	}

	setTime := srv.SetTime

	return memorySetup{client: client, cleanup: cleanup, setTime: setTime}, nil
}
