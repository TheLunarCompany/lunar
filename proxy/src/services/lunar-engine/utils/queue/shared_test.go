package queue_test

import (
	"lunar/engine/utils/queue"
	"lunar/toolkit-core/clock"
	"time"
)

var epochTime = time.Unix(0, 0)

func enqueue(
	clock clock.Clock,
	req *queue.Request,
	resultsCh chan enqueueResult,
	startTime time.Time,
	dpq queue.DelayedPriorityQueueable,
	ttl time.Duration,
) chan struct{} {
	startCh := make(chan struct{})
	go func() {
		<-startCh // Wait for a signal to start
		startTime = clock.Now()
		result, _ := dpq.Enqueue(req, ttl)
		resultsCh <- enqueueResult{
			finished:  true,
			id:        req.ID,
			result:    result,
			runtime:   clock.Now().Sub(startTime),
			startTime: startTime,
		}
	}()

	return startCh
}

func dispatchAndGatherResults(
	clock clock.Clock,
	resultsCh chan enqueueResult,
	startChannels []chan struct{},
	windowSize time.Duration,
) map[string]enqueueResult {
	// ensure we don't start dispatching near the end of a window
	<-clock.After(getDurationTillWindowEnd(clock, windowSize))
	// dispatch
	for i := 0; i < len(startChannels); i++ {
		startChannels[i] <- struct{}{}
		clock.Sleep(time.Millisecond * 100)
	}

	// gather results
	results := map[string]enqueueResult{}
	for i := 0; i < len(startChannels); i++ {
		result := <-resultsCh
		results[result.id] = result
	}

	return results
}

func getDurationTillWindowEnd(
	clock clock.Clock,
	windowSize time.Duration,
) time.Duration {
	currentTime := clock.Now()
	elapsedTime := currentTime.Sub(epochTime)
	currentWindowStartTime := epochTime.Add(
		(elapsedTime / windowSize) * windowSize,
	)
	return currentWindowStartTime.Add(windowSize).Sub(currentTime)
}

// When a mock clock will be used, controlling the time would be more
// accurate. Right now there are minor delays which cause assumptions
// to be flakey (e.g.:
//
//	Error: "250.120291ms" is not less than or equal to "250ms")
func buffer(t time.Duration) time.Duration {
	return t + 100*time.Millisecond
}
