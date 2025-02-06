package lunarcontext

import (
	"fmt"
	public_types "lunar/engine/streams/public-types"
	"lunar/toolkit-core/clock"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	windowStartKeySuffix = "_window_start"
	counterKeySuffix     = "_counter"
)

type memoryState[T public_types.PersistentType] struct {
	contextMemory public_types.ContextI
	mutex         sync.Mutex
	clock         clock.Clock
}

func NewMemoryState[T public_types.PersistentType]() public_types.SharedStateI[T] {
	context := &memoryState[T]{
		contextMemory: NewContext(),
	}
	return context
}

func (p *memoryState[T]) WithClock(clock clock.Clock) public_types.SharedStateI[T] {
	p.clock = clock
	return p
}

func (p *memoryState[T]) AtomicWindowReset(key string, _ time.Duration) error {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	windowStartKey := p.buildKey(key, windowStartKeySuffix)
	counterKey := p.buildKey(key, counterKeySuffix)

	if err := p.contextMemory.Set(windowStartKey, p.clock.Now().UTC().Unix()); err != nil {
		return err
	}

	return p.contextMemory.Set(counterKey, int64(0))
}

func (p *memoryState[T]) NewQueue(key string, itemTTL time.Duration) public_types.SharedQueueI {
	return NewMemoryQueue(key, itemTTL)
}

func (p *memoryState[T]) AtomicWindowResetIn(
	key string,
	windowSize time.Duration,
) (time.Duration, bool, error) {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	windowStartKey := p.buildKey(key, windowStartKeySuffix)
	currentTime := p.clock.Now().UTC()

	endWindow := p.atomicGetWindow(windowStartKey).Add(windowSize)
	timeRemaining := endWindow.Sub(currentTime)
	return timeRemaining, timeRemaining <= 0, nil
}

func (p *memoryState[T]) AtomicIncWindow(
	key string,
	incrBy int64,
	windowSize time.Duration,
	maxAllowedInWindow int64,
) (int64, bool, error) {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	windowRestarted := false
	var counterRaw interface{}

	currentCounter := int64(0)
	windowStartKey := p.buildKey(key, windowStartKeySuffix)
	counterKey := p.buildKey(key, counterKeySuffix)

	currentTime := p.clock.Now().UTC()
	windowStart := p.atomicGetWindow(windowStartKey)

	// If the current time is outside the current window, reset the window
	if currentTime.Sub(windowStart) >= windowSize {
		windowStart = currentTime
		windowRestarted = true
	} else {
		counterRaw, _ = p.Get(counterKey)
		var converted bool
		currentCounter, converted = counterRaw.(int64)

		if !converted {
			return 0, windowRestarted, fmt.Errorf("value for key %s is not an int64", key)
		}
	}

	currentCounter = currentCounter + incrBy
	if currentCounter > maxAllowedInWindow {
		return 0, windowRestarted, fmt.Errorf("exceeded max allowed in window")
	}

	if err := p.setInt64(windowStartKey, windowStart.Unix()); err != nil {
		log.Trace().Msg("Failed to set window start")
	}

	if err := p.setInt64(counterKey, currentCounter); err != nil {
		return 0, windowRestarted, err
	}
	return currentCounter, windowRestarted, nil
}

// Exists implements public_types.SharedStateI.
func (p *memoryState[T]) Exists(key string) bool {
	return p.contextMemory.Exists(key)
}

// Get implements public_types.SharedStateI.
func (p *memoryState[T]) Get(key string) (T, error) {
	return p.memoryStateRetrieve(key, p.contextMemory.Get)
}

// GetMany implements public_types.SharedStateI.
func (p *memoryState[T]) GetMany(key string, _ int64) ([]T, error) {
	res, err := p.memoryStateRetrieve(key, p.contextMemory.Get)
	if err != nil {
		return nil, err
	}
	return []T{res}, nil
}

// Pop implements public_types.SharedStateI.
func (p *memoryState[T]) Pop(key string) (T, error) {
	return p.memoryStateRetrieve(key, p.contextMemory.Pop)
}

// Set implements public_types.SharedStateI.
func (p *memoryState[T]) Set(key string, value T) error {
	return p.contextMemory.Set(key, value)
}

func (p *memoryState[T]) setInt64(key string, value int64) error {
	return p.contextMemory.Set(key, value)
}

// SetWithScore implements public_types.SharedStateI.
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

func (p *memoryState[T]) atomicGetWindow(key string) time.Time {
	var windowStartRaw interface{}
	windowStart := p.clock.Now().UTC()
	var err error

	windowStartRaw, err = p.Get(key)
	if err == nil {
		windowStartSec, converted := windowStartRaw.(int64)
		if converted {
			windowStart = time.Unix(windowStartSec, 0).UTC()
		}
	}
	return windowStart
}

func (p *memoryState[T]) buildKey(key string, suffix string) string {
	return fmt.Sprintf("%s // %s", key, suffix)
}
