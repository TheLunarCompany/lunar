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
	Set(key K, value V, ttlSec float64) error
	Del(key K)
	WithMaxCacheSize(calculateSizeFunc func(K, V) float64, maxCacheSize float64)
}

type MemoryCache[K comparable, V any] struct {
	cache              map[K]ValueWrapper[V]
	mutex              sync.RWMutex
	clock              clock.Clock
	calculateCacheSize bool
	maxCacheSize       float64
	currentCacheSize   float64
	calculateSizeFunc  func(key K, value V) float64
}

type ValueWrapper[V any] struct {
	value              V
	expirationTimeNano int64
}

func (cache *MemoryCache[K, V]) Has(key K) bool {
	log.Trace().Msgf("Checking cache key %v", key)
	ensureCacheInitialized(cache)
	cache.mutex.RLock()
	valueWrapper, found := cache.cache[key]
	cache.mutex.RUnlock()

	if valueExpired(cache, key, valueWrapper.expirationTimeNano) {
		return false
	}

	if found {
		log.Trace().Msgf("Cache key %v found", key)
	} else {
		log.Trace().Msgf("Cache key %v not found", key)
	}
	return found
}

func (cache *MemoryCache[K, V]) Get(key K) (V, bool) {
	log.Trace().Msgf("Getting cache key %v", key)
	ensureCacheInitialized(cache)
	var value V
	cache.mutex.RLock()
	valueWrapper, found := cache.cache[key]
	cache.mutex.RUnlock()
	if !found {
		log.Trace().Msgf("Cache miss for key %v", key)
		return value, false
	}

	if valueExpired(cache, key, valueWrapper.expirationTimeNano) {
		return value, false
	}

	log.Trace().Msgf("Cache hit for key %v", key)

	return valueWrapper.value, true
}

func valueExpired[K comparable, V any](
	cache *MemoryCache[K, V],
	key K,
	expirationTimeNano int64,
) bool {
	if cache.clock.Now().UnixNano() > expirationTimeNano {
		log.Trace().Msgf("Cache expired for key %v", key)
		return true
	}
	return false
}

func (cache *MemoryCache[K, V]) Set(key K, value V, ttlSec float64) error {
	log.Debug().Msgf(
		"Setting cache key %v to value %+v with ttl %v", key, value, ttlSec)
	ensureCacheInitialized(cache)

	itemSize := float64(0)
	if cache.calculateCacheSize && cache.calculateSizeFunc != nil {
		// We might miss here a momentary case of adding 2 messages when
		// there is enough place for only one.
		// The choice to put the check outside of the lock is intentional,
		// we are 'saving' value allocation and lock by checking the size first
		itemSize = cache.calculateSizeFunc(key, value)
		if cache.currentCacheSize+itemSize > cache.maxCacheSize {
			return fmt.Errorf(
				"Cannot add item: max cache size would be exceeded."+
					" Current cache size is %v",
				cache.currentCacheSize)
		}
	}

	ttlDuration := time.Duration(float64(time.Second) * ttlSec)
	expirationTimeNano := cache.clock.Now().UnixNano() +
		ttlDuration.Nanoseconds()

	cache.mutex.Lock()
	cache.cache[key] = ValueWrapper[V]{value, expirationTimeNano}
	if cache.calculateCacheSize {
		cache.currentCacheSize += itemSize
	}
	cache.mutex.Unlock()

	go func() {
		cache.clock.Sleep(ttlDuration)
		clearKey(cache, key)
	}()
	return nil
}

func (cache *MemoryCache[K, V]) Del(key K) {
	log.Trace().Msgf("Deleting cache key %v", key)
	ensureCacheInitialized(cache)
	clearKey(cache, key)
}

func (cache *MemoryCache[K, V]) WithMaxCacheSize(
	calculateSizeFunc func(K, V) float64, maxCacheSize float64,
) {
	cache.calculateCacheSize = true
	cache.calculateSizeFunc = calculateSizeFunc
	cache.maxCacheSize = maxCacheSize
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
		cache:              map[K]ValueWrapper[V]{},
		mutex:              sync.RWMutex{},
		clock:              clock,
		calculateCacheSize: false,
		maxCacheSize:       1, // TBD - get default value
		currentCacheSize:   0,
		calculateSizeFunc:  nil,
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
	if cache.calculateCacheSize {
		valueWrapper, found := cache.cache[key]
		if found {
			cache.currentCacheSize -= cache.calculateSizeFunc(key, valueWrapper.value)
		}
	}
	delete(cache.cache, key)
	cache.mutex.Unlock()
}
