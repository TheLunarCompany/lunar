package utils

import (
	"fmt"
	"lunar/toolkit-core/clock"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

type Cache[K any, V any] interface {
	Has(key K) bool
	Get(key K) (V, bool)
	Set(key K, value V, ttlSec float64)
	Del(key K)
}

type MemoryCache[K comparable, V any] struct {
	cache map[K]ValueWrapper[V]
	mutex sync.RWMutex
	clock clock.Clock
}

type ValueWrapper[V any] struct {
	value              V
	expirationTimeNano int64
}

func (cache *MemoryCache[K, V]) Has(key K) bool {
	log.Debug().Msgf("Checking cache key %v", key)
	ensureCacheInitialized(cache)
	cache.mutex.RLock()
	valueWrapper, found := cache.cache[key]
	cache.mutex.RUnlock()

	if valueExpired(cache, key, valueWrapper.expirationTimeNano) {
		return false
	}

	if found {
		log.Debug().Msgf("Cache key %v found", key)
	} else {
		log.Debug().Msgf("Cache key %v not found", key)
	}
	return found
}

func (cache *MemoryCache[K, V]) Get(key K) (V, bool) {
	log.Debug().Msgf("Getting cache key %v", key)
	ensureCacheInitialized(cache)
	var value V
	cache.mutex.RLock()
	valueWrapper, found := cache.cache[key]
	cache.mutex.RUnlock()
	if !found {
		log.Debug().Msgf("Cache miss for key %v", key)
		return value, false
	}

	if valueExpired(cache, key, valueWrapper.expirationTimeNano) {
		return value, false
	}

	log.Debug().Msgf("Cache hit for key %v", key)

	return valueWrapper.value, true
}

func valueExpired[K comparable, V any](
	cache *MemoryCache[K, V],
	key K,
	expirationTimeNano int64,
) bool {
	if cache.clock.Now().UnixNano() > expirationTimeNano {
		log.Debug().Msgf("Cache expired for key %v", key)
		return true
	}
	return false
}

func (cache *MemoryCache[K, V]) Set(key K, value V, ttlSec float64) {
	log.Debug().Msgf(
		"Setting cache key %v to value %+v with ttl %v", key, value, ttlSec)
	ensureCacheInitialized(cache)
	ttlDuration := time.Duration(float64(time.Second) * ttlSec)
	expirationTimeNano := cache.clock.Now().UnixNano() +
		ttlDuration.Nanoseconds()

	cache.mutex.Lock()
	cache.cache[key] = ValueWrapper[V]{value, expirationTimeNano}
	cache.mutex.Unlock()

	go func() {
		cache.clock.Sleep(ttlDuration)
		clearKey(cache, key)
	}()
}

func (cache *MemoryCache[K, V]) Del(key K) {
	log.Debug().Msgf("Deleting cache key %v", key)
	ensureCacheInitialized(cache)
	clearKey(cache, key)
}

// This function is used for printing the cache in debug logs
// It is needed to avoid concurrent map read and map write errors
func (cache *MemoryCache[K, V]) String() string {
	ensureCacheInitialized(cache)
	cache.mutex.RLock()
	defer cache.mutex.RUnlock()
	return fmt.Sprintf("%+v", cache.cache)
}

func NewMemoryCache[K comparable, V any](clock clock.Clock) *MemoryCache[K, V] {
	return &MemoryCache[K, V]{
		cache: map[K]ValueWrapper[V]{},
		mutex: sync.RWMutex{},
		clock: clock,
	}
}

func ensureCacheInitialized[K comparable, V any](cache *MemoryCache[K, V]) {
	cache.mutex.Lock()
	if cache.cache == nil {
		cache.cache = map[K]ValueWrapper[V]{}
	}
	cache.mutex.Unlock()
}

func clearKey[K comparable, V any](cache *MemoryCache[K, V], key K) {
	cache.mutex.Lock()
	delete(cache.cache, key)
	cache.mutex.Unlock()
}
