package processorqueue

import (
	publictypes "lunar/engine/streams/public-types"
	clock "lunar/toolkit-core/clock"
	"sync"
	"time"
)

type Request struct {
	ID           string
	priority     int64
	timestamp    time.Time
	doneCh       chan struct{}
	processMutex sync.Mutex
	isProcessed  bool
	APIStream    publictypes.APIStreamI
}

func NewRequest(
	reqID string,
	priority int64,
	clock clock.Clock,
	APIStream publictypes.APIStreamI,
) *Request {
	return &Request{
		ID:           reqID,
		priority:     priority,
		timestamp:    clock.Now(),
		doneCh:       make(chan struct{}),
		processMutex: sync.Mutex{},
		isProcessed:  false,
		APIStream:    APIStream,
	}
}

func (r *Request) CloseChan() {
	close(r.doneCh)
}
