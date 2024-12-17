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

type SharedStateI[T PersistentType] interface {
	WithClock(clock.Clock) SharedStateI[T]
	Set(string, T) error
	SetWithScore(string, float64, T) error

	Get(string) (T, error)
	GetMany(string, int64) ([]T, error)

	Pop(string) (T, error)
	AtomicWindowReset(string, time.Duration) error
	AtomicIncWindow(string, time.Duration, int64) (int64, error)
	AtomicWindowResetIn(string, time.Duration) (time.Duration, error)
	Exists(string) bool
}

// Constraint for types acceptable for persistent storage (strings, numbers, slices of these types)
type PersistentType interface {
	constraints.Integer |
		constraints.Float |
		~string |
		bool |
		[]string |
		[]bool |
		[]int64 |
		[]int |
		[]float64
}
