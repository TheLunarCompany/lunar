package resources

import "sync"

type Resource[T any] struct {
	mutex sync.RWMutex
	data  map[string]T
}

func NewResource[T any]() *Resource[T] {
	return &Resource[T]{
		data: make(map[string]T),
	}
}

func (r *Resource[T]) Get(key string) (T, bool) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()
	val, ok := r.data[key]
	return val, ok
}

func (r *Resource[T]) Set(key string, value T) {
	r.mutex.Lock()
	defer r.mutex.Unlock()
	r.data[key] = value
}
