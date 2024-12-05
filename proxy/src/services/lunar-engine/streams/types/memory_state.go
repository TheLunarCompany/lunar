package streamtypes

import (
	"fmt"
	publictypes "lunar/engine/streams/public-types"
)

type memoryState[T publictypes.PersistentType] struct {
	contextMemory publictypes.ContextI
}

func NewMemoryState[T publictypes.PersistentType]() publictypes.SharedStateI[T] {
	context := &memoryState[T]{
		contextMemory: NewContext(),
	}
	return context
}

// Exists implements publictypes.SharedStateI.
func (p *memoryState[T]) Exists(key string) bool {
	return p.contextMemory.Exists(key)
}

// Get implements publictypes.SharedStateI.
func (p *memoryState[T]) Get(key string) (T, error) {
	return p.memoryStateRetrieve(key, p.contextMemory.Get)
}

// GetMany implements publictypes.SharedStateI.
func (p *memoryState[T]) GetMany(key string, _ int64) ([]T, error) {
	res, err := p.memoryStateRetrieve(key, p.contextMemory.Get)
	if err != nil {
		return nil, err
	}
	return []T{res}, nil
}

// Pop implements publictypes.SharedStateI.
func (p *memoryState[T]) Pop(key string) (T, error) {
	return p.memoryStateRetrieve(key, p.contextMemory.Pop)
}

// Set implements publictypes.SharedStateI.
func (p *memoryState[T]) Set(key string, value T) error {
	return p.contextMemory.Set(key, value)
}

// SetWithScore implements publictypes.SharedStateI.
func (p *memoryState[T]) SetWithScore(key string, _ float64, value T) error {
	return p.Set(key, value)
}

// memoryStateRetrieve retrieves a value from the memory state.
func (p *memoryState[T]) memoryStateRetrieve(
	key string,
	call func(string) (interface{}, error),
) (result T, err error) {
	memRes, err := call(key)
	if err != nil {
		return result, err
	}
	var ok bool
	result, ok = memRes.(T)
	if !ok {
		return result, fmt.Errorf("failed to cast value to type %T", result)
	}
	return result, nil
}
