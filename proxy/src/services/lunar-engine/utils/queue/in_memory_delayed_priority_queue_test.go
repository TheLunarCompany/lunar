package queue_test

import (
	"fmt"
	"lunar/engine/utils/queue"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

type enqueueResult struct {
	finished  bool
	id        string
	result    bool
	runtime   time.Duration
	startTime time.Time
}

func TestDelayedPriorityQueueProcessesRequestImmediately(t *testing.T) {
	clock := clock.NewRealClock()

	windowSize := time.Millisecond * 250
	ttl := time.Millisecond * 1000

	strategy := queue.Strategy{WindowQuota: 1, WindowSize: windowSize}
	queueKey := queue.QueueKey{RemedyName: "foo", Strategy: strategy}
	dpq := queue.NewInMemoryDelayedPriorityQueue(
		queueKey,
		clock,
		logging.ContextLogger{},
	)
	req := queue.NewRequest("A", 1, clock)
	result, err := dpq.Enqueue(req, ttl)

	assert.Nil(t, err)
	assert.True(t, result)
}

func TestDelayedPriorityQueueProcessesRequestImmediatelyInSubsequentWindow(
	t *testing.T,
) {
	clock := clock.NewRealClock()

	windowSize := time.Millisecond * 250
	ttl := time.Millisecond * 1000

	strategy := queue.Strategy{WindowQuota: 1, WindowSize: windowSize}
	queueKey := queue.QueueKey{RemedyName: "foo", Strategy: strategy}
	dpq := queue.NewInMemoryDelayedPriorityQueue(
		queueKey,
		clock,
		logging.ContextLogger{},
	)

	reqA := queue.NewRequest("A", 1, clock)
	resultA, err := dpq.Enqueue(reqA, ttl)

	assert.Nil(t, err)
	assert.True(t, resultA)

	// ensure a window passes
	clock.Sleep(buffer(windowSize))

	reqB := queue.NewRequest("B", 1, clock)
	resultB, err := dpq.Enqueue(reqB, ttl)
	assert.Nil(t, err)

	assert.True(t, resultB)
}

func TestDelayedQueueReturnsCorrectCountOfRequestsInQueue(t *testing.T) {
	clock := clock.NewRealClock()

	windowSize := time.Millisecond * 250
	ttl := time.Millisecond * 1000
	priority := 1.0

	strategy := queue.Strategy{WindowQuota: 1, WindowSize: windowSize}
	queueKey := queue.QueueKey{RemedyName: "foo", Strategy: strategy}
	dpq := queue.NewInMemoryDelayedPriorityQueue(
		queueKey,
		clock,
		logging.ContextLogger{},
	)

	reqA := queue.NewRequest("A", priority, clock)
	reqB := queue.NewRequest("B", priority, clock)

	go dpq.Enqueue(reqA, ttl) //nolint: errcheck
	go dpq.Enqueue(reqB, ttl) //nolint: errcheck

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
	queueKey := queue.QueueKey{RemedyName: "foo", Strategy: strategy}
	dpq := queue.NewInMemoryDelayedPriorityQueue(
		queueKey,
		clock,
		logging.ContextLogger{},
	)

	reqA := queue.NewRequest("A", 1, clock)
	go dpq.Enqueue(reqA, ttl) //nolint: errcheck

	// Ensure that the first request is processed
	clock.Sleep(1 * time.Millisecond)

	reqB := queue.NewRequest("B", 1, clock)
	go dpq.Enqueue(reqB, ttl) //nolint: errcheck

	reqC := queue.NewRequest("C", 2, clock)
	go dpq.Enqueue(reqC, ttl) //nolint: errcheck

	reqD := queue.NewRequest("B", 3, clock)
	go dpq.Enqueue(reqD, ttl) //nolint: errcheck

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
	queueKey := queue.QueueKey{RemedyName: "foo", Strategy: strategy}
	dpq := queue.NewInMemoryDelayedPriorityQueue(
		queueKey,
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
		windowSize,
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
	printRes(results)
}

func TestDelayedPriorityQueueReturnsFalseForRequestWhichTTLs(t *testing.T) {
	clock := clock.NewRealClock()

	windowSize := time.Millisecond * 250
	// ttl is set to window size, so no requests can actually get a
	// green light if they cannot come out in current window
	ttl := time.Millisecond * 250

	strategy := queue.Strategy{WindowQuota: 1, WindowSize: windowSize}
	queueKey := queue.QueueKey{RemedyName: "foo", Strategy: strategy}
	dpq := queue.NewInMemoryDelayedPriorityQueue(
		queueKey,
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
		windowSize,
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
	queueKey := queue.QueueKey{RemedyName: "foo", Strategy: strategy}
	dpq := queue.NewInMemoryDelayedPriorityQueue(
		queueKey,
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
		windowSize,
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
	queueKey := queue.QueueKey{RemedyName: "foo", Strategy: strategy}
	dpq := queue.NewInMemoryDelayedPriorityQueue(
		queueKey,
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
		windowSize,
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

	printRes(results)
}

func printRes(results map[string]enqueueResult) {
	for name, result := range results {
		fmt.Printf(
			"Result for %s: result: %v, runtime: %+v, start time: %+v",
			name,
			result.result,
			result.runtime,
			result.startTime,
		)
		fmt.Printf("\n")
	}
}
