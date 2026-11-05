//go:build !pro

package lunarcontext

import (
	publictypes "lunar/engine/streams/public-types"
)

func NewSharedState[T publictypes.PersistentType]() publictypes.SharedStateI[T] {
	return NewMemoryState[T]()
}
