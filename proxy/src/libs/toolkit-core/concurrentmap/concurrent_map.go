package concurrentmap

import "sync"

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
