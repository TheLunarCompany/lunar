package configstate

import (
	internaltypes "lunar/engine/streams/internal-types"
	"sync"
)

type ConfigState struct {
	txnMu sync.Mutex
	mu    sync.RWMutex

	flows map[string]internaltypes.FlowI
}
