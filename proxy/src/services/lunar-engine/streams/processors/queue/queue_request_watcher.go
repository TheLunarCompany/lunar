package processorqueue

import (
	clock "lunar/toolkit-core/clock"
	context_manager "lunar/toolkit-core/context-manager"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog"
)

type RequestWatcher struct {
	clock            clock.Clock
	requestsMapMutex sync.RWMutex
	expireMapMutex   sync.RWMutex

	requests         map[string]*Request
	requestsExpireAt map[string]time.Time
	nextExpireAt     atomic.Value
	defaultTTL       time.Duration
	logger           zerolog.Logger
	requestCount     atomic.Int64
}

func NewRequestsWatcher(queueTTL time.Duration, logger zerolog.Logger) *RequestWatcher {
	clock := context_manager.Get().GetClock()

	requestWatcher := &RequestWatcher{
		clock:            clock,
		defaultTTL:       queueTTL,
		requests:         make(map[string]*Request),
		requestsExpireAt: make(map[string]time.Time),
		requestCount:     atomic.Int64{},
		logger: logger.With().
			Str("module", "RequestWatcher").
			Logger(),
	}

	requestWatcher.nextExpireAt.Store(clock.Now().Add(queueTTL))
	go requestWatcher.manageTTLs()
	return requestWatcher
}

func (watcher *RequestWatcher) GetCount() int64 {
	return watcher.requestCount.Load()
}

func (watcher *RequestWatcher) GetRequest(requestID string) (*Request, bool) {
	watcher.requestsMapMutex.RLock()
	defer watcher.requestsMapMutex.RUnlock()

	req, found := watcher.requests[requestID]
	return req, found
}

func (watcher *RequestWatcher) AddRequest(req *Request) {
	watcher.requestCount.Add(1)

	watcher.requestsMapMutex.Lock()
	watcher.requests[req.GetID()] = req
	watcher.requestsMapMutex.Unlock()

	watcher.expireMapMutex.Lock()
	watcher.requestsExpireAt[req.GetID()] = req.GetExpireAt()
	watcher.expireMapMutex.Unlock()
}

func (watcher *RequestWatcher) RemoveFromWatchList(requestID string) {
	watcher.requestCount.Add(-1)

	watcher.requestsMapMutex.Lock()
	delete(watcher.requests, requestID)
	watcher.requestsMapMutex.Unlock()

	watcher.expireMapMutex.Lock()
	delete(watcher.requestsExpireAt, requestID)
	watcher.expireMapMutex.Unlock()
}

func (watcher *RequestWatcher) StopAll() {
	watcher.requestsMapMutex.RLock()
	defer watcher.requestsMapMutex.RUnlock()

	for _, request := range watcher.requests {
		request.SetProcessedTimeout()
	}
}

func (watcher *RequestWatcher) manageTTLs() {
	ctx := context_manager.Get().GetContext()

	for {
		nextExpiration, castSuccessful := watcher.nextExpireAt.Load().(time.Time)
		if !castSuccessful {
			watcher.logger.Debug().Msg("Failed to cast nextExpireAt to time.Time, reapplying default TTL")
			watcher.nextExpireAt.Store(watcher.clock.Now().Add(watcher.defaultTTL))
			continue
		}

		waitDuration := nextExpiration.Sub(watcher.clock.Now())

		if waitDuration < 0 {
			waitDuration = 0
		}

		select {
		case <-time.After(waitDuration):
			watcher.notifyExpiredRequests()
		case <-ctx.Done():
			return
		}
	}
}

func (watcher *RequestWatcher) recalculateNextExpireAt() {
	nextExpiration := watcher.clock.Now().Add(watcher.defaultTTL)
	watcher.expireMapMutex.RLock()

	for _, expireAt := range watcher.requestsExpireAt {
		if expireAt.Before(nextExpiration) {
			nextExpiration = expireAt
		}
	}

	watcher.expireMapMutex.RUnlock()
	watcher.nextExpireAt.Store(nextExpiration)
}

func (watcher *RequestWatcher) notifyExpiredRequests() {
	expiredRequestIDs := []string{}

	watcher.expireMapMutex.RLock()
	for requestID, expireAt := range watcher.requestsExpireAt {
		if watcher.clock.Now().After(expireAt) {
			expiredRequestIDs = append(expiredRequestIDs, requestID)
		}
	}
	watcher.expireMapMutex.RUnlock()

	for _, requestID := range expiredRequestIDs {
		req, found := watcher.GetRequest(requestID)
		if found && req.StartProcessing() {
			watcher.logger.Trace().Msgf("Request %s is expired", requestID)
			req.SetProcessedTimeout()
		}
	}

	watcher.recalculateNextExpireAt()
}
