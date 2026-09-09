//go:build pro

package readcache

import (
	"context"
	"lunar/engine/actions"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/clock"
	"os"
	"testing"
	"time"

	processor_write_cache "lunar/engine/streams/processors/write-cache"
	public_types "lunar/engine/streams/public-types"
	test_utils "lunar/engine/streams/test-utils"
	streamtypes "lunar/engine/streams/types"
	redis_client "lunar/toolkit-core/redis-client"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"

	"github.com/stretchr/testify/require"
)

var (
	miniRedisSrv *miniredis.Miniredis
	redisClient  *redis_client.Client
)

func TestMain(m *testing.M) {
	_, cleanup, err := setupInMemoryRedis()
	if err != nil {
		panic(err)
	}

	redisClient, err = redis_client.GetClient(context.Background(), clock.NewMockClock())
	if err != nil {
		panic(err)
	}

	// Run the tests
	code := m.Run()

	cleanup()

	os.Exit(code)
}

func TestReadCache(t *testing.T) {
	miniRedisSrv.FlushAll()

	proc := createReadCacheProcessor(t)
	writeProc := createWriteCacheProcessor(t, 3)

	stream := test_utils.NewMockAPIStream(
		"https://example.com/org789/orders?resource_id=res456",
		map[string]string{"api_key": "key123"},
		map[string]string{"Content-Type": "application/json"},
		`{"dummy":"request"}`,
		`{"dummy":"test response"}`,
	)

	// Execute the WriteCache processor to store the response in the cache.
	stream.SetType(public_types.StreamTypeResponse)
	_, err := writeProc.Execute("testFlow", stream)
	require.NoError(t, err)

	// Execute the ReadCache processor.
	stream.SetType(public_types.StreamTypeRequest)
	output, err := proc.Execute("testFlow", stream)
	require.NoError(t, err)
	require.NotNil(t, output)

	earlyResp := output.ReqAction.(*actions.EarlyResponseAction)
	require.Equal(t, `{"dummy":"test response"}`, earlyResp.Body)
	require.Equal(t, hitConditionName, output.Name)

	// Execute the ReadCache processor  with different key
	newStream := test_utils.NewMockAPIStream(
		"https://example.com/org789/orders?resource_id=res456",
		map[string]string{"api_key": "key124"},
		map[string]string{"Content-Type": "application/json"},
		`{"dummy":"request"}`,
		`{"dummy":"test response"}`,
	)
	output, err = proc.Execute("testFlow", newStream)
	require.NoError(t, err)
	require.NotNil(t, output)

	_, ok := output.ReqAction.(*actions.NoOpAction)
	require.True(t, ok)
	require.Equal(t, missConditionName, output.Name)

	// Execute the ReadCache processor again, after TTL expires.
	time.Sleep(4 * time.Second)

	output, err = proc.Execute("testFlow", stream)
	require.NoError(t, err)
	require.NotNil(t, output)

	_, ok = output.ReqAction.(*actions.NoOpAction)
	require.True(t, ok)
	require.Equal(t, missConditionName, output.Name)
}

func createReadCacheProcessor(t *testing.T) streamtypes.ProcessorI {
	params := make(map[string]streamtypes.ProcessorParam)
	params["caching_key_parts"] = streamtypes.ProcessorParam{
		Name: "caching_key_parts",
		Value: public_types.NewParamValue([]string{
			"$.request.headers.api_key",
			"$.request.query_param.resource_id",
			"$.request.path_segments[1]",
		}),
	}
	metaData := &streamtypes.ProcessorMetaData{
		Name:       "ReadCache",
		Parameters: params,
	}
	proc, err := NewProcessor(metaData)
	require.NoError(t, err)
	return proc
}

func createWriteCacheProcessor(t *testing.T, ttlSeconds int) streamtypes.ProcessorI {
	params := make(map[string]streamtypes.ProcessorParam)
	params["ttl_seconds"] = streamtypes.ProcessorParam{
		Name:  "ttl_seconds",
		Value: public_types.NewParamValue(ttlSeconds),
	}
	params["record_max_size_bytes"] = streamtypes.ProcessorParam{
		Name:  "record_max_size_bytes",
		Value: public_types.NewParamValue(-1),
	}
	params["max_cache_size_mb"] = streamtypes.ProcessorParam{
		Name:  "max_cache_size_mb",
		Value: public_types.NewParamValue(100),
	}
	params["caching_key_parts"] = streamtypes.ProcessorParam{
		Name: "caching_key_parts",
		Value: public_types.NewParamValue(
			[]string{
				"$.request.headers.api_key",
				"$.request.query_param.resource_id",
				"$.request.path_segments[1]",
			},
		),
	}

	metaData := &streamtypes.ProcessorMetaData{
		Name:       "WriteCache",
		Parameters: params,
	}
	proc, err := processor_write_cache.NewProcessor(metaData)
	require.NoError(t, err)

	return proc
}

func setupInMemoryRedis() (*redis.Client, func(), error) {
	srv, err := miniredis.Run()
	if err != nil {
		return nil, nil, err
	}
	miniRedisSrv = srv

	client := redis.NewClient(&redis.Options{
		Addr: srv.Addr(),
	})

	prevRedisURL := environment.SetRedisURL("redis://" + client.Options().Addr)
	prevUseRedisCluster := environment.SetRedisUseCluster(false)
	prevRedisOLRetryAttempts := environment.SetRedisMaxOLRetryAttempts(50)
	prevRedisMaxRetryAttempts := environment.SetRedisMaxRetryAttempts(10)
	prevRedisRetryBackoffTime := environment.SetRedisRetryBackoffTime(50)

	cleanup := func() {
		srv.Close()
		environment.SetRedisURL(prevRedisURL)
		environment.SetRedisUseCluster(prevUseRedisCluster)
		environment.SetRedisMaxOLRetryAttempts(prevRedisOLRetryAttempts)
		environment.SetRedisMaxRetryAttempts(prevRedisMaxRetryAttempts)
		environment.SetRedisRetryBackoffTime(prevRedisRetryBackoffTime)
	}

	return client, cleanup, nil
}
