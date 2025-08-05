package queue

import (
	"container/heap"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"sync"
	"time"
)

var epochTime = time.Unix(0, 0)

type DelayedPriorityQueue struct {
	strategy             Strategy
	currentWindowCounter int64
	currentWindowEndTime time.Time
	requestCounts        map[float64]int64
	mutex                sync.RWMutex
	queue                PriorityQueue
	clock                clock.Clock
	cl                   logging.ContextLogger
}

func NewInMemoryDelayedPriorityQueue(
	queueKey QueueKey,
	clock clock.Clock,
	contextLogger logging.ContextLogger,
) *DelayedPriorityQueue {
	dpq := &DelayedPriorityQueue{ //nolint:exhaustruct
		strategy:      queueKey.Strategy,
		cl:            contextLogger.WithComponent("delayed-priority-queue"),
		requestCounts: map[float64]int64{},
		clock:         clock,
	}

	heap.Init(&dpq.queue)
	dpq.ensureWindowIsUpdated()
	go dpq.process()

	return dpq
}

func (dpq *DelayedPriorityQueue) Enqueue(
	req *Request,
	ttl time.Duration,
	maxQueueSize int64,
) (bool, error) {
	dpq.mutex.Lock()

	dpq.cl.Logger.Trace().Str("requestID", req.ID).
		Msgf("Enqueueing request, currentWindowCounter: %d, windowQuota: %d",
			dpq.currentWindowCounter, dpq.strategy.WindowQuota)

	dpq.ensureWindowIsUpdated()

	// Requests are processed in current window, if quota allows for it
	if dpq.currentWindowCounter < dpq.strategy.WindowQuota {
		dpq.currentWindowCounter++
		dpq.mutex.Unlock()
		close(req.doneCh)
		dpq.cl.Logger.Trace().
			Str("requestId", req.ID).
			Msg("Request processed in current window")

		return true, nil
	}

	if dpq.totalQueueCount() >= maxQueueSize {
		dpq.mutex.Unlock()
		dpq.cl.Logger.Trace().Str("requestID", req.ID).
			Msgf("Request dropped due to queue size limit")
		return false, nil

	}

	dpq.cl.Logger.Trace().Str("requestID", req.ID).
		Msgf("Sending request to be processed in queue")
	heap.Push(&dpq.queue, req)
	dpq.requestCounts[req.priority]++

	dpq.mutex.Unlock()

	// Wait until request is processed or TTL expires
	select {
	case <-req.doneCh:
		dpq.cl.Logger.Trace().
			Str("requestID", req.ID).
			Msgf("Request processing completed")
		dpq.mutex.Lock()
		defer dpq.mutex.Unlock()
		dpq.requestCounts[req.priority]--
		return true, nil
	case <-dpq.clock.After(ttl):
		dpq.cl.Logger.Trace().Str("requestID", req.ID).
			Msgf("Request TTLed (now: %+v, ttl: %+v)", dpq.clock.Now(), ttl)
		dpq.mutex.Lock()
		defer dpq.mutex.Unlock()
		dpq.requestCounts[req.priority]--
		return false, nil
	}
}

func (dpq *DelayedPriorityQueue) Counts() map[float64]int64 {
	dpq.mutex.RLock()
	defer dpq.mutex.RUnlock()
	return deepCopyMap(dpq.requestCounts)
}

func deepCopyMap(m map[float64]int64) map[float64]int64 {
	result := map[float64]int64{}
	for k, v := range m {
		result[k] = v
	}
	return result
}

func (dpq *DelayedPriorityQueue) GetTimeTillWindowEnd() time.Duration {
	dpq.mutex.RLock()
	res := dpq.currentWindowEndTime.Sub(dpq.clock.Now())
	dpq.mutex.RUnlock()

	return res
}

func (dpq *DelayedPriorityQueue) ensureWindowIsUpdated() {
	currentTime := dpq.clock.Now()
	elapsedTime := currentTime.Sub(epochTime)
	currentWindowStartTime := epochTime.Add(
		(elapsedTime / dpq.strategy.WindowSize) * dpq.strategy.WindowSize,
	)
	updatedWindowEndTime := currentWindowStartTime.Add(dpq.strategy.WindowSize)
	if updatedWindowEndTime.After(dpq.currentWindowEndTime) {
		dpq.currentWindowCounter = 0
		dpq.currentWindowEndTime = updatedWindowEndTime
	}
}

func (dpq *DelayedPriorityQueue) totalQueueCount() int64 {
	// Please note that this function is not thread-safe and should be used with caution.
	totalCount := int64(0)
	for _, count := range dpq.requestCounts {
		totalCount += count
	}
	return totalCount
}

func (dpq *DelayedPriorityQueue) process() {
	for {
		<-dpq.clock.After(dpq.GetTimeTillWindowEnd())
		dpq.mutex.Lock()
		dpq.ensureWindowIsUpdated()
		dpq.processQueueItems()
		dpq.mutex.Unlock()
	}
}

func (dpq *DelayedPriorityQueue) processQueueItems() {
	for dpq.queue.Len() > 0 &&
		dpq.currentWindowCounter < dpq.strategy.WindowQuota {
		req, valid := heap.Pop(&dpq.queue).(*Request)
		if !valid {
			dpq.cl.Logger.Error().
				Msg("Could not cast priorityQueue item as Request, " +
					"will not process")
			continue
		}
		dpq.cl.Logger.Trace().
			Str("requestID", req.ID).
			Msgf("Attempt to process queued request")
		select {
		case req.doneCh <- struct{}{}:
			close(req.doneCh)
			dpq.currentWindowCounter++
			dpq.cl.Logger.Trace().Str("requestID", req.ID).
				Msgf("notified successful request processing to req.doneCh")
		default:
			dpq.cl.Logger.Trace().Str("requestID", req.ID).
				Msgf("req.doneCh already closed")
		}
		dpq.cl.Logger.Trace().Msgf("request %s processed in queue", req.ID)
	}
}
