package publictypes

import (
	"lunar/toolkit-core/clock"
	"time"

	"golang.org/x/exp/constraints"
)

type ContextI interface {
	Set(string, interface{}) error
	Get(string) (interface{}, error)
	Pop(string) (interface{}, error)

	Exists(string) bool
}

type LunarContextI interface {
	GetGlobalContext() ContextI
	GetFlowContext() ContextI
	GetTransactionalContext() ContextI
}

type SharedQueueI interface {
	Enqueue(string, float64) error
	DequeueIfValueRelevant() string
	Remove(string)
	Size() int64
}

type SharedStateI[T PersistentType] interface {
	WithClock(clock.Clock) SharedStateI[T]
	Set(string, T) error
	SetWithScore(string, float64, T) error
	NewQueue(string, time.Duration) SharedQueueI
	Get(string) (T, error)
	GetMany(string, int64) ([]T, error)

	Pop(string) (T, error)
	AtomicWindowReset(string, time.Duration) error
	AtomicIncr(string, int64) (bool, error)
	AtomicDecr(string) error

	// The bool indicator in the return value indicates whether the window was reset
	// This comment is relevant for both AtomicIncWindow and AtomicWindowResetIn
	AtomicIncWindow(string, int64, time.Duration, int64) (int64, bool, error)
	AtomicWindowResetIn(string, time.Duration) (time.Duration, bool, error)
	GetQuotaCounter(string) (int64, error)
	Exists(string) bool
}

// Constraint for types acceptable for persistent storage (strings, numbers, slices of these types)
type PersistentType interface {
	constraints.Integer |
		constraints.Float |
		~string |
		bool |
		byte |
		[]string |
		[]bool |
		[]int64 |
		[]int |
		[]float64 |
		[]byte
}
