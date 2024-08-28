package publictypes

import "golang.org/x/exp/constraints"

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
	Set(string, T) error
	SetWithScore(string, float64, T) error

	Get(string) (T, error)
	GetMany(string, int64) ([]T, error)

	Pop(string) (T, error)

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
