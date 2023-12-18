package queue_test

import (
	"lunar/engine/utils/queue"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

type enqueueResult struct {
	finished bool
	id       string
	result   bool
	runtime  time.Duration
}

func TestDelayedPriorityQueueProcessesRequestImmediately(t *testing.T) {
	clock := clock.NewRealClock()

	windowSize := time.Millisecond * 250
	ttl := time.Millisecond * 1000

	strategy := queue.Strategy{WindowQuota: 1, WindowSize: windowSize}
	dpq := queue.NewDelayedPriorityQueue(
		strategy,
		clock,
		logging.ContextLogger{},
	)
	req := queue.NewRequest("A", 1, clock)
	result := dpq.Enqueue(req, ttl)

	assert.True(t, result)
}

func TestDelayedPriorityQueueProcessesRequestImmediatelyInSubsequentWindow(
	t *testing.T,
) {
	clock := clock.NewRealClock()

	windowSize := time.Millisecond * 250
	ttl := time.Millisecond * 1000

	strategy := queue.Strategy{WindowQuota: 1, WindowSize: windowSize}
	dpq := queue.NewDelayedPriorityQueue(
		strategy,
		clock,
		logging.ContextLogger{},
	)

	reqA := queue.NewRequest("A", 1, clock)
	resultA := dpq.Enqueue(reqA, ttl)

	assert.True(t, resultA)

	// ensure a window passes
	clock.Sleep(buffer(windowSize))

	reqB := queue.NewRequest("B", 1, clock)
	resultB := dpq.Enqueue(reqB, ttl)

	assert.True(t, resultB)
}

func TestDelayedQueueReturnsCorrectCountOfRequestsInQueue(t *testing.T) {
	clock := clock.NewRealClock()

	windowSize := time.Millisecond * 250
	ttl := time.Millisecond * 1000
	priority := 1

	strategy := queue.Strategy{WindowQuota: 1, WindowSize: windowSize}
	dpq := queue.NewDelayedPriorityQueue(
		strategy,
		clock,
		logging.ContextLogger{},
	)

	reqA := queue.NewRequest("A", priority, clock)
	reqB := queue.NewRequest("B", priority, clock)

	go dpq.Enqueue(reqA, ttl)
	go dpq.Enqueue(reqB, ttl)

	clock.Sleep(1 * time.Millisecond)

	counts := dpq.Counts()
	// Since there is 1 request allowed in the window, the second request
	// should still be in the queue
	assert.Equal(t, 1, counts[priority])
}

func TestDelayedQueueReturnsCorrectCountOfRequestsInQueueGroupedByPriority(
	t *testing.T,
) {
	clock := clock.NewRealClock()

	windowSize := time.Millisecond * 250
	ttl := time.Millisecond * 1000

	strategy := queue.Strategy{WindowQuota: 1, WindowSize: windowSize}
	dpq := queue.NewDelayedPriorityQueue(
		strategy,
		clock,
		logging.ContextLogger{},
	)

	reqA := queue.NewRequest("A", 1, clock)
	go dpq.Enqueue(reqA, ttl)

	// Ensure that the first request is processed
	clock.Sleep(1 * time.Millisecond)

	reqB := queue.NewRequest("B", 1, clock)
	go dpq.Enqueue(reqB, ttl)

	reqC := queue.NewRequest("C", 2, clock)
	go dpq.Enqueue(reqC, ttl)

	reqD := queue.NewRequest("B", 3, clock)
	go dpq.Enqueue(reqD, ttl)

	clock.Sleep(1 * time.Millisecond)

	counts := dpq.Counts()

	// Since there is 1 request allowed in the window, the second
	// request for priority 1 should still be in the queue
	assert.Equal(t, 1, counts[1])
	assert.Equal(t, 1, counts[2])
	assert.Equal(t, 1, counts[3])
}

func TestDelayedPriorityQueueProcessesRequestAtALaterWindow(t *testing.T) {
	clock := clock.NewRealClock()

	windowSize := time.Millisecond * 250
	ttl := time.Millisecond * 1000

	strategy := queue.Strategy{WindowQuota: 1, WindowSize: windowSize}
	dpq := queue.NewDelayedPriorityQueue(
		strategy,
		clock,
		logging.ContextLogger{},
	)
	resultsCh := make(chan enqueueResult, 3)

	startTime := clock.Now()

	// build three requests with a minimal timestamp diff between them
	req1 := queue.NewRequest("A", 1, clock)
	clock.Sleep(time.Millisecond)
	req2 := queue.NewRequest("B", 1, clock)
	clock.Sleep(time.Millisecond)
	req3 := queue.NewRequest("C", 1, clock)

	startCh1 := enqueue(clock, req1, resultsCh, startTime, dpq, ttl)
	startCh2 := enqueue(clock, req2, resultsCh, startTime, dpq, ttl)
	startCh3 := enqueue(clock, req3, resultsCh, startTime, dpq, ttl)

	results := dispatchAndGatherResults(
		clock,
		resultsCh,
		[]chan struct{}{startCh1, startCh2, startCh3},
	)

	// all requests should be given a green light (return `true`)
	assert.True(t, results["A"].result)
	assert.True(t, results["B"].result)
	assert.True(t, results["C"].result)

	// Req A should be processed immediately
	assert.LessOrEqual(t, results["A"].runtime, time.Millisecond*10)

	// Req B should be processed at the 1st window
	assert.LessOrEqual(t, results["B"].runtime, buffer(windowSize))

	// Req C should be processed at the 2nd window
	assert.Greater(t, results["C"].runtime, windowSize)
	assert.LessOrEqual(t, results["C"].runtime, buffer(windowSize*2))
}

func TestDelayedPriorityQueueReturnsFalseForRequestWhichTTLs(t *testing.T) {
	clock := clock.NewRealClock()

	windowSize := time.Millisecond * 250
	// ttl is set to window size, so no requests can actually get a
	// green light if they cannot come out in current window
	ttl := time.Millisecond * 250

	strategy := queue.Strategy{WindowQuota: 1, WindowSize: windowSize}
	dpq := queue.NewDelayedPriorityQueue(
		strategy,
		clock,
		logging.ContextLogger{},
	)
	resultsCh := make(chan enqueueResult, 3)

	startTime := clock.Now()

	req1 := queue.NewRequest("A", 1, clock)
	clock.Sleep(time.Millisecond)
	req2 := queue.NewRequest("B", 1, clock)
	clock.Sleep(time.Millisecond)
	req3 := queue.NewRequest("C", 1, clock)

	startCh1 := enqueue(clock, req1, resultsCh, startTime, dpq, ttl)
	startCh2 := enqueue(clock, req2, resultsCh, startTime, dpq, ttl)
	startCh3 := enqueue(clock, req3, resultsCh, startTime, dpq, ttl)

	results := dispatchAndGatherResults(
		clock,
		resultsCh,
		[]chan struct{}{startCh1, startCh2, startCh3},
	)

	// the first two requests can be processed within TTL time
	assert.True(t, results["A"].result)
	assert.True(t, results["B"].result)
	// the third request can not be processed before it TTLs
	assert.False(t, results["C"].result)

	// Req A should be processed immediately
	assert.LessOrEqual(t, results["A"].runtime, time.Millisecond*10)

	// Req B should be processed at the 1st window
	assert.LessOrEqual(t, results["B"].runtime, buffer(windowSize))

	// Req C TTLs within the 2nd window
	assert.Greater(t, results["C"].runtime, windowSize)
	assert.LessOrEqual(t, results["C"].runtime, buffer(windowSize*2))
}

func TestDelayedPriorityQueueProcessesNonImmediateRequestAccordingToPriority(
	t *testing.T,
) {
	clock := clock.NewRealClock()

	windowSize := time.Millisecond * 250
	ttl := time.Millisecond * 1000

	strategy := queue.Strategy{WindowQuota: 1, WindowSize: windowSize}
	dpq := queue.NewDelayedPriorityQueue(
		strategy,
		clock,
		logging.ContextLogger{},
	)
	resultsCh := make(chan enqueueResult, 3)

	startTime := clock.Now()

	req1 := queue.NewRequest("A", 1, clock)
	clock.Sleep(time.Millisecond)
	req2 := queue.NewRequest("B", 2, clock)
	clock.Sleep(time.Millisecond)
	req3 := queue.NewRequest("C", 1, clock)

	startCh1 := enqueue(clock, req1, resultsCh, startTime, dpq, ttl)
	startCh2 := enqueue(clock, req2, resultsCh, startTime, dpq, ttl)
	startCh3 := enqueue(clock, req3, resultsCh, startTime, dpq, ttl)

	results := dispatchAndGatherResults(
		clock,
		resultsCh,
		[]chan struct{}{startCh1, startCh2, startCh3},
	)

	// all requests should be given a green light (return `true`)
	assert.True(t, results["A"].result)
	assert.True(t, results["B"].result)
	assert.True(t, results["C"].result)

	// Req A should be processed immediately
	assert.LessOrEqual(t, results["A"].runtime, time.Millisecond*10)

	// Req C should be processed at the 1st window
	assert.LessOrEqual(t, results["C"].runtime, buffer(windowSize))

	// Req B should be processed at the 2nd window
	assert.Greater(t, results["B"].runtime, windowSize)
	assert.LessOrEqual(t, results["B"].runtime, buffer(windowSize*2))
}

func TestDelayedPriorityQueueTTLsRequestIfHigherPriorityRequestTakesItsPlace(
	t *testing.T,
) {
	clock := clock.NewRealClock()

	windowSize := time.Millisecond * 250
	ttl := time.Millisecond * 250

	strategy := queue.Strategy{WindowQuota: 1, WindowSize: windowSize}
	dpq := queue.NewDelayedPriorityQueue(
		strategy,
		clock,
		logging.ContextLogger{},
	)
	resultsCh := make(chan enqueueResult, 3)

	req1 := queue.NewRequest("A", 1, clock)
	clock.Sleep(time.Millisecond)
	req2 := queue.NewRequest("B", 2, clock)
	clock.Sleep(time.Millisecond)
	req3 := queue.NewRequest("C", 1, clock)

	startTime := clock.Now()

	startCh1 := enqueue(clock, req1, resultsCh, startTime, dpq, ttl)
	startCh2 := enqueue(clock, req2, resultsCh, startTime, dpq, ttl)
	startCh3 := enqueue(clock, req3, resultsCh, startTime, dpq, ttl)

	results := dispatchAndGatherResults(
		clock,
		resultsCh,
		[]chan struct{}{startCh1, startCh2, startCh3},
	)

	// only requests A & C should be given a green light (return `true`)
	assert.True(t, results["A"].result)
	assert.False(t, results["B"].result)
	assert.True(t, results["C"].result)

	// Req A should be processed immediately
	assert.LessOrEqual(t, results["A"].runtime, time.Millisecond*10)

	// Req C should be processed at the 1st window
	assert.LessOrEqual(t, results["C"].runtime, buffer(windowSize))

	// Req B should be processed at the 2nd window
	assert.Greater(t, results["B"].runtime, windowSize)
	assert.LessOrEqual(t, results["B"].runtime, buffer(windowSize*2))
}

func enqueue(
	clock clock.Clock,
	req *queue.Request,
	resultsCh chan enqueueResult,
	startTime time.Time,
	dpq *queue.DelayedPriorityQueue,
	ttl time.Duration,
) chan struct{} {
	startCh := make(chan struct{})
	go func() {
		<-startCh // Wait for a signal to start
		result := dpq.Enqueue(req, ttl)
		resultsCh <- enqueueResult{
			finished: true,
			id:       req.ID,
			result:   result,
			runtime:  clock.Now().Sub(startTime),
		}
	}()

	return startCh
}

func dispatchAndGatherResults(
	clock clock.Clock,
	resultsCh chan enqueueResult,
	startChannels []chan struct{},
) map[string]enqueueResult {
	// dispatch
	for i := 0; i < len(startChannels); i++ {
		startChannels[i] <- struct{}{}
		clock.Sleep(time.Millisecond)
	}

	// gather results
	results := map[string]enqueueResult{}
	for i := 0; i < len(startChannels); i++ {
		result := <-resultsCh
		results[result.id] = result
	}

	return results
}

// When a mock clock will be used, controlling the time would be more
// accurate. Right now there are minor delays which cause assumptions
// to be flakey (e.g.:
//
//	Error: "250.120291ms" is not less than or equal to "250ms")
func buffer(t time.Duration) time.Duration {
	return t + 5*time.Millisecond
}
