package queue

import (
	"container/heap"
	"lunar/toolkit-core/clock"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

var epochTime = time.Unix(0, 0)

type DelayedPriorityQueue struct {
	windowQuota          int
	windowSize           time.Duration
	currentWindowCounter int
	currentWindowEndTime time.Time
	mutex                sync.RWMutex
	queue                PriorityQueue
	clock                clock.Clock
}

func NewDelayedPriorityQueue(
	allowedRequestCount int,
	windowSize time.Duration,
	clock clock.Clock,
) *DelayedPriorityQueue {
	dpq := &DelayedPriorityQueue{ //nolint:exhaustruct
		windowQuota: allowedRequestCount,
		windowSize:  windowSize,
		clock:       clock,
	}

	heap.Init(&dpq.queue)
	dpq.ensureWindowIsUpdated()
	go dpq.process()

	return dpq
}

func (dpq *DelayedPriorityQueue) Enqueue(
	req *Request,
	ttl time.Duration,
) bool {
	dpq.mutex.Lock()

	log.Trace().Str("requestID", req.ID).
		Msgf("Enqueueing request, currentWindowCounter: %d, windowQuota: %d",
			dpq.currentWindowCounter, dpq.windowQuota)

	dpq.ensureWindowIsUpdated()

	// Requests are processed in current window, if quota allows for it
	if dpq.currentWindowCounter < dpq.windowQuota {
		dpq.currentWindowCounter++
		dpq.mutex.Unlock()
		close(req.doneCh)
		log.Trace().
			Str("requestId", req.ID).
			Msg("Request processed in current window")

		return true
	}

	log.Trace().Str("requestID", req.ID).
		Msgf("Sending request to be processed in queue")
	heap.Push(&dpq.queue, req)

	dpq.mutex.Unlock()

	// Wait until request is processed or TTL expires
	select {
	case <-req.doneCh:
		log.Trace().
			Str("requestID", req.ID).
			Msgf("Request processing completed")
		return true
	case <-dpq.clock.After(ttl):
		log.Trace().Str("requestID", req.ID).
			Msgf("Request TTLed (now: %+v, ttl: %+v)", dpq.clock.Now(), ttl)
		return false
	}
}

func (dpq *DelayedPriorityQueue) getTimeTillWindowEnd() time.Duration {
	dpq.mutex.RLock()
	res := dpq.currentWindowEndTime.Sub(dpq.clock.Now())
	dpq.mutex.RUnlock()

	return res
}

func (dpq *DelayedPriorityQueue) ensureWindowIsUpdated() {
	currentTime := dpq.clock.Now()
	elapsedTime := currentTime.Sub(epochTime)
	currentWindowStartTime := epochTime.Add(
		(elapsedTime / dpq.windowSize) * dpq.windowSize,
	)
	updatedWindowEndTime := currentWindowStartTime.Add(dpq.windowSize)
	if updatedWindowEndTime.After(dpq.currentWindowEndTime) {
		dpq.currentWindowCounter = 0
		dpq.currentWindowEndTime = updatedWindowEndTime
	}
}

func (dpq *DelayedPriorityQueue) process() {
	for {
		<-dpq.clock.After(dpq.getTimeTillWindowEnd())
		dpq.mutex.Lock()
		dpq.ensureWindowIsUpdated()
		dpq.processQueueItems()
		dpq.mutex.Unlock()
	}
}

func (dpq *DelayedPriorityQueue) processQueueItems() {
	for dpq.queue.Len() > 0 && dpq.currentWindowCounter < dpq.windowQuota {
		req, valid := heap.Pop(&dpq.queue).(*Request)
		if !valid {
			log.Error().
				Msg("could not cast priorityQueue item as Request, " +
					"will not process")
			continue
		}
		log.Trace().
			Str("requestID", req.ID).
			Msgf("Attempt to process queued request")
		select {
		case req.doneCh <- struct{}{}:
			close(req.doneCh)
			dpq.currentWindowCounter++
			log.Trace().Str("requestID", req.ID).
				Msgf("notified successful request processing to req.doneCh")
		default:
			log.Trace().Str("requestID", req.ID).
				Msgf("req.doneCh already closed")
		}
	}
}
