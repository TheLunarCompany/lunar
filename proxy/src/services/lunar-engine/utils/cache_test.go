package utils_test

import (
	"lunar/engine/utils"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/testutils"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestGivenCacheIsEmptyGetReturnsNotFound(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	cache := utils.NewMemoryCache[string, int](clock)
	key := "key"
	has := cache.Has(key)
	assert.False(t, has)
	_, found := cache.Get(key)
	assert.False(t, found)
}

func TestGivenCacheIsSetGetReturnsValue(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	cache := utils.NewMemoryCache[string, int](clock)
	wantKey := "key"
	wantValue := 99
	cache.Set(wantKey, wantValue, 1)
	has := cache.Has(wantKey)
	assert.True(t, has)
	value, found := cache.Get(wantKey)
	assert.True(t, found)
	assert.Equal(t, wantValue, value)
}

func TestGivenCacheIsSetGetReturnsValueOnlyBeforeTTLHasPassed(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	cache := utils.NewMemoryCache[string, int](clock)
	wantKey := "key"
	wantValue := 99
	var ttlSec float64 = 1
	cache.Set(wantKey, wantValue, ttlSec)
	has := cache.Has(wantKey)
	assert.True(t, has)
	value, found := cache.Get(wantKey)
	assert.True(t, found)
	assert.Equal(t, wantValue, value)

	timeToAdvance := testutils.PlusEpsilon(time.Duration(ttlSec) * time.Second)
	clock.AdvanceTime(timeToAdvance)

	has = cache.Has(wantKey)
	assert.False(t, has)
	_, found = cache.Get(wantKey)
	assert.False(t, found)
}

func TestGivenCacheIsSetGetReturnsValueBeforeDelIsCalled(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	cache := utils.NewMemoryCache[string, int](clock)
	wantKey := "key"
	wantValue := 99
	var ttlSec float64 = 1
	cache.Set(wantKey, wantValue, ttlSec)
	has := cache.Has(wantKey)
	assert.True(t, has)
	value, found := cache.Get(wantKey)
	assert.True(t, found)
	assert.Equal(t, wantValue, value)

	cache.Del(wantKey)
	has = cache.Has(wantKey)
	assert.False(t, has)
	_, found = cache.Get(wantKey)
	assert.False(t, found)
}

func TestGivenParallelCacheWritesAndReadsCacheWorksAsExpected(t *testing.T) {
	t.Parallel()
	testutils.TestInParallel(t, 100, "TestCache", func(t *testing.T) {
		testReadWrite(t, "key", 99)
	})
}

func TestGivenParallelCacheWithStructValueWritesAndReadsCacheWorksAsExpected(
	t *testing.T,
) {
	t.Parallel()
	testutils.TestInParallel(t, 100, "TestCache", func(t *testing.T) {
		testReadWrite(t, "key", struct{ A int }{A: 99})
	})
}

func testReadWrite[K comparable, V any](t *testing.T, wantKey K, wantValue V) {
	clock := clock.NewMockClock()
	cache := utils.NewMemoryCache[K, V](clock)
	var ttlSec float64 = 1
	cache.Set(wantKey, wantValue, ttlSec)
	has := cache.Has(wantKey)
	assert.True(t, has)
	value, found := cache.Get(wantKey)
	assert.True(t, found)
	assert.Equal(t, wantValue, value)

	timeToAdvance := testutils.PlusEpsilon(time.Duration(ttlSec) * time.Second)
	clock.AdvanceTime(timeToAdvance)

	has = cache.Has(wantKey)
	assert.False(t, has)
	_, found = cache.Get(wantKey)
	assert.False(t, found)
}
