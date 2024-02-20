package concurrentmap

import (
	"sync"

	"github.com/rs/zerolog/log"
	"golang.org/x/exp/constraints"
)

type ConcurrentMap[K comparable, V any] struct {
	mutex     sync.RWMutex
	simpleMap map[K]V
}

func NewConcurrentMap[K comparable, V any]() ConcurrentMap[K, V] {
	return ConcurrentMap[K, V]{
		mutex:     sync.RWMutex{},
		simpleMap: map[K]V{},
	}
}

func (concurrentMap *ConcurrentMap[K, V]) Lookup(key K) (V, bool) {
	concurrentMap.mutex.RLock()
	value, found := concurrentMap.simpleMap[key]
	concurrentMap.mutex.RUnlock()
	return value, found
}

func (concurrentMap *ConcurrentMap[K, V]) Assign(key K, value V) {
	concurrentMap.mutex.Lock()
	concurrentMap.simpleMap[key] = value
	concurrentMap.mutex.Unlock()
}

func (concurrentMap *ConcurrentMap[K, V]) Delete(key K) {
	concurrentMap.mutex.Lock()
	delete(concurrentMap.simpleMap, key)
	concurrentMap.mutex.Unlock()
}

func (concurrentMap *ConcurrentMap[K, V]) LookupOrAssign(
	key K,
	fallbackValue V,
) V {
	concurrentMap.mutex.Lock()
	defer concurrentMap.mutex.Unlock()

	value, found := concurrentMap.simpleMap[key]
	if found {
		return value
	}

	concurrentMap.simpleMap[key] = fallbackValue
	return fallbackValue
}

func (concurrentMap *ConcurrentMap[K, V]) MapCopy() map[K]V {
	concurrentMap.mutex.RLock()
	defer concurrentMap.mutex.RUnlock()

	result := map[K]V{}
	for k, v := range concurrentMap.simpleMap {
		result[k] = v
	}
	// TEMPORARY
	log.Debug().Msgf("Redis DPQ MapCopy(): %+v", concurrentMap.simpleMap) //nolint:lll
	return result
}

type IncrementableConcurrentMap[K comparable, V constraints.Integer] struct { //nolint:lll
	ConcurrentMap[K, V]
}

func NewIncrementableConcurrentMap[K comparable, V constraints.Integer]() IncrementableConcurrentMap[K, V] { //nolint: lll
	return IncrementableConcurrentMap[K, V]{
		ConcurrentMap: NewConcurrentMap[K, V](),
	}
}

func (concurrentMap *IncrementableConcurrentMap[K, V]) Increment(key K) V {
	concurrentMap.mutex.Lock()
	defer concurrentMap.mutex.Unlock()

	concurrentMap.simpleMap[key]++
	res := concurrentMap.simpleMap[key]

	// TEMPORARY
	log.Debug().Msgf("Redis DPQ IncrementableConcurrentMap() - (after): %+v", concurrentMap.simpleMap) //nolint:lll

	return res
}

func (concurrentMap *IncrementableConcurrentMap[K, V]) Decrement(key K) V {
	concurrentMap.mutex.Lock()
	defer concurrentMap.mutex.Unlock()

	concurrentMap.simpleMap[key]--
	res := concurrentMap.simpleMap[key]
	return res
}
