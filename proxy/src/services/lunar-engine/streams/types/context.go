//go:build !pro

package streamtypes

import (
	publictypes "lunar/engine/streams/public-types"
)

func NewSharedState[T publictypes.PersistentType]() publictypes.SharedStateI[T] {
	return NewMemoryState[T]()
}
