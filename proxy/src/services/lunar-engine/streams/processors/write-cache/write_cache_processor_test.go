//go:build pro

package writecache

import (
	"context"
	"encoding/json"
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/streams/processors/utils"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/clock"
	"os"
	"strconv"
	"testing"
	"time"

	lunar_messages "lunar/engine/messages"
	processor_read_cache "lunar/engine/streams/processors/read-cache"
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

// TestWriteCache verifies that:
//   - The cache key is built correctly by concatenating values extracted from the API stream:
//     header "api_key", query param "resource_id", and URL path param (extracted from the URL).
//   - The response is stored in Redis as a JSON entry built by BuildSharedMemoryTTLEntry.
//   - The stored entry is parsed correctly using ParseSharedMemoryTTLEntry.
//   - The cache size is updated correctly.
func TestWriteCache(t *testing.T) {
	miniRedisSrv.FlushAll()

	proc := createWriteCacheProcessor(t, 600, 8192, 200)
	readProc := createReadCacheProcessor(t)

	stream := test_utils.NewMockAPIStream(
		"https://example.com/org789/orders?resource_id=res456",
		map[string]string{"api_key": "key123"},
		map[string]string{"Content-Type": "application/json"},
		`{"dummy":"request"}`,
		`{"dummy":"test response"}`,
	)
	expectedKey := "testFlow_key123_res456_org789"

	stream.SetType(public_types.StreamTypeResponse)
	_, err := proc.Execute("testFlow", stream)
	require.NoError(t, err)

	// check that the cache entry is stored in Redis
	onResponse, alive := getTTLResponseFromCache(t, expectedKey)
	require.True(t, alive, "expected cache entry to be alive")
	require.Equal(t, "application/json", onResponse.Headers["Content-Type"], "response headers mismatch")
	require.Equal(t, `{"dummy":"test response"}`, onResponse.Body, "response payload mismatch")

	// check that the cache entry is read correctly
	stream.SetType(public_types.StreamTypeRequest)
	output, err := readProc.Execute("testFlow", stream)
	require.NoError(t, err)
	require.NotNil(t, output)

	earlyResp := output.ReqAction.(*actions.EarlyResponseAction)
	require.Equal(t, `{"dummy":"test response"}`, earlyResp.Body)
	require.Equal(t, "cache_hit", output.Name)

	// cache size should be updated
	cacheEntry, err := utils.BuildSharedMemoryTTLEntry(600, stream.GetResponse())
	require.NoError(t, err)

	expectedEntrySize := len(cacheEntry)
	cacheSizeKey := "testFlow_WriteCache_used_cache_size"
	cacheSize := getValueFromRedis[int64](t, cacheSizeKey)
	require.Equal(t, int64(expectedEntrySize), cacheSize, "cache size mismatch")

	// Execute the WriteCache processor again with a different key.
	stream.GetRequest().GetHeaders()["api_key"] = "key456"
	stream.SetType(public_types.StreamTypeResponse)
	_, err = proc.Execute("testFlow", stream)
	require.NoError(t, err)

	cacheSize = getValueFromRedis[int64](t, cacheSizeKey)
	require.Equal(t, int64(expectedEntrySize*2), cacheSize, "cache size mismatch")
}

// TestWriteCache_RecordMaxSize ensures that if the response payload exceeds the configured maximum size,
// Execute returns an error and no cache entry is stored in Redis.
func TestWriteCache_RecordMaxSize(t *testing.T) {
	miniRedisSrv.FlushAll()
	proc := createWriteCacheProcessor(t, 600, 8192, 200)
	readProc := createReadCacheProcessor(t)

	// Create an oversized response payload (8200 bytes > 8192 bytes limit).
	oversized := make([]byte, 8200)
	for i := range oversized {
		oversized[i] = 'a'
	}
	oversizedStr := string(oversized)

	// Build a mock API stream with the oversized response payload.
	stream := test_utils.NewMockAPIStream(
		"https://example.com/org789/orders?resource_id=res456",
		map[string]string{"api_key": "key123"},
		map[string]string{"resource_id": "res456"},
		`{"dummy":"request"}`,
		oversizedStr,
	)

	stream.SetType(public_types.StreamTypeResponse)
	_, err := proc.Execute("testFlow", stream)
	require.NoError(t, err)

	// Verify that no cache entry is stored.
	expectedKey := "testFlow_key123_res456_org789"
	exists := miniRedisSrv.Exists(expectedKey)
	require.False(t, exists, "oversized record should not be cached in Redis")

	stream.SetType(public_types.StreamTypeRequest)
	output, err := readProc.Execute("testFlow", stream)
	require.NoError(t, err)
	require.NotNil(t, output)

	_, ok := output.ReqAction.(*actions.NoOpAction)
	require.True(t, ok)
	require.Equal(t, "cache_miss", output.Name)

	// Verify that the cache size is not updated.
	cacheSizeKey := "testFlow_WriteCache_used_cache_size"
	cacheSize := getValueFromRedis[int64](t, cacheSizeKey)
	require.Equal(t, int64(0), cacheSize, "cache size should not be updated")
}

// TestWriteCache_MaxCacheSizeEviction simulates writing multiple entries to trigger the overall cache size limit.
// We verify that when the cache is full, Execute returns an error and the entry is not stored;
// then, after flushing the cache, writing succeeds again.
func TestWriteCache_MaxCacheSizeEviction(t *testing.T) {
	miniRedisSrv.FlushAll()

	proc := createWriteCacheProcessor(t, 600, 8192, 1) // Set a small cache size
	readProc := createReadCacheProcessor(t)

	largeBody := make([]byte, 5120)
	for i := range largeBody {
		largeBody[i] = 'a'
	}
	responseBody := string(largeBody)

	var evictionErrorOccurred bool

	for i := 0; i < 500; i++ {
		apiKey := "key" + strconv.Itoa(i)
		resourceID := "res" + strconv.Itoa(i)
		organization := "org" + strconv.Itoa(i)
		url := fmt.Sprintf("https://example.com/%v/orders?resource_id=%v", organization, resourceID)

		stream := test_utils.NewMockAPIStream(
			url,
			map[string]string{"api_key": apiKey},
			map[string]string{"resource_id": resourceID},
			`{"dummy":"request"}`,
			responseBody,
		)
		stream.SetType(public_types.StreamTypeResponse)
		_, err := proc.Execute("testFlow", stream)
		require.NoError(t, err)

		// test if cache entry was skipped due to limit
		stream.SetType(public_types.StreamTypeRequest)
		output, err := readProc.Execute("testFlow", stream)
		require.NoError(t, err)
		require.NotNil(t, output)
		if _, ok := output.ReqAction.(*actions.NoOpAction); ok {
			evictionErrorOccurred = true
			require.Equal(t, "cache_miss", output.Name)
			break
		}
	}
	require.True(t, evictionErrorOccurred, "expected at least one Execute call to error due to cache size limit")

	miniRedisSrv.FlushAll()

	// should now succeed.
	stream := test_utils.NewMockAPIStream(
		"https://example.com/org789/orders?resource_id=res456",
		map[string]string{"api_key": "keyTest"},
		map[string]string{"resource_id": "resTest"},
		`{"dummy":"request"}`,
		responseBody,
	)
	stream.SetType(public_types.StreamTypeResponse)
	_, err := proc.Execute("testFlow", stream)
	require.NoError(t, err, "expected write to succeed after cache flush")

	// Verify entry stored in Redis.
	stream.SetType(public_types.StreamTypeRequest)
	output, err := readProc.Execute("testFlow", stream)
	require.NoError(t, err)
	require.NotNil(t, output)

	earlyResp := output.ReqAction.(*actions.EarlyResponseAction)
	require.Equal(t, responseBody, earlyResp.Body)
	require.Equal(t, "cache_hit", output.Name)
}

// TestWriteCache_EntryActiveStatus verifies that the cached entry stores a timestamp and that
// ParseSharedMemoryTTLEntry correctly calculates whether the entry is still active based on TTL.
func TestWriteCache_EntryActiveStatus(t *testing.T) {
	miniRedisSrv.FlushAll()

	proc := createWriteCacheProcessor(t, 2, 8192, 200)

	stream := test_utils.NewMockAPIStream(
		"https://example.com/org789/orders?resource_id=res456",
		map[string]string{"api_key": "key123"},
		map[string]string{"Content-Type": "application/json"},
		`{"dummy":"request"}`,
		`{"dummy":"test response"}`,
	)
	expectedKey := "testFlow_key123_res456_org789"

	stream.SetType(public_types.StreamTypeResponse)
	_, err := proc.Execute("testFlow", stream)
	require.NoError(t, err)

	// Retrieve the stored cache entry from Redis.
	onResponse, alive := getTTLResponseFromCache(t, expectedKey)
	require.True(t, alive, "expected cache entry to be alive")
	require.Equal(t, `{"dummy":"test response"}`, onResponse.Body, "response payload mismatch")

	time.Sleep(6 * time.Second)

	// Retrieve the entry again.
	_, alive = getTTLResponseFromCache(t, expectedKey)
	require.NoError(t, err)
	require.False(t, alive, "entry should be inactive after TTL expires")
}

func getValueFromRedis[T public_types.PersistentType](t *testing.T, key string) T {
	redisKey := redis_client.NewKey().Append(redis_client.UnhashedKeyPart(key))
	value, err := redisClient.ZRange(redisKey, 1, false)
	require.NoError(t, err)

	var result T

	if len(value) == 0 {
		return result
	}

	err = json.Unmarshal([]byte(value[0]), &result)
	require.NoError(t, err)

	return result
}

func getTTLResponseFromCache(t *testing.T, key string) (lunar_messages.OnResponse, bool) {
	storedBytes := getValueFromRedis[[]byte](t, key)

	ttlEntry, err := utils.ParseSharedMemoryTTLEntry(storedBytes)
	require.NoError(t, err)

	var onResponse lunar_messages.OnResponse
	err = json.Unmarshal(ttlEntry.Content, &onResponse)
	require.NoError(t, err)

	return onResponse, ttlEntry.IsAlive()
}

func createWriteCacheProcessor(
	t *testing.T,
	ttlSeconds, recordMaxSizeBytes, maxCacheSizeMegabytes int,
) streamtypes.ProcessorI {
	params := make(map[string]streamtypes.ProcessorParam)
	params["ttl_seconds"] = streamtypes.ProcessorParam{
		Name:  "ttl_seconds",
		Value: public_types.NewParamValue(ttlSeconds),
	}
	params["record_max_size_bytes"] = streamtypes.ProcessorParam{
		Name:  "record_max_size_bytes",
		Value: public_types.NewParamValue(recordMaxSizeBytes),
	}
	params["max_cache_size_mb"] = streamtypes.ProcessorParam{
		Name:  "max_cache_size_mb",
		Value: public_types.NewParamValue(maxCacheSizeMegabytes),
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
	proc, err := NewProcessor(metaData)
	require.NoError(t, err)

	return proc
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
	proc, err := processor_read_cache.NewProcessor(metaData)
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
