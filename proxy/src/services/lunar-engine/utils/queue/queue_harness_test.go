//go:build pro

package queue_test

import (
	"lunar/engine/utils/queue"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"lunar/toolkit-core/redis"
	"lunar/toolkit-core/testutils"
	"testing"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/samber/lo"
	"github.com/stretchr/testify/require"
)

const AcceptableTimeDelta = time.Millisecond * 10

func newReqData(reqID string, priority float64) lo.Tuple2[string, float64] {
	return lo.Tuple2[string, float64]{A: reqID, B: priority}
}

type enqueueResult struct {
	finished  bool
	id        string
	result    bool
	runtime   time.Duration
	startTime time.Time
}

type queueTestHarness struct {
	t *testing.T

	strategy                 queue.Strategy
	queueKey                 queue.QueueKey
	redisKey                 redis.Key
	redisClient              *redis.Client
	redisSetTimeFunc         func(time.Time)
	testRequests             []*queue.Request
	startDispatch            []chan struct{}
	resultsCh                chan enqueueResult
	getDurationTillWindowEnd func() time.Duration

	windowQuota int64
	WindowSize  time.Duration
	TTL         time.Duration
	QueueSize   int64
	Clock       *clock.MockClock
	DPQ         queue.DelayedPriorityQueueable
}

// newQueueTestHarness - creates new test harness with window quota 1
// Expects windowSize and TTL in milliseconds
func newQueueTestHarness(t *testing.T,
	windowSizeMs int,
	ttlMs int,
	queueSize int64,
) *queueTestHarness {
	return newQueueTestHarnessCustom(t,
		1,
		time.Millisecond*time.Duration(windowSizeMs),
		time.Millisecond*time.Duration(ttlMs), queueSize)
}

func newQueueTestHarnessCustom(t *testing.T,
	windowQuota int64,
	windowSize time.Duration,
	ttl time.Duration,
	queueSize int64,
) *queueTestHarness {
	clock := clock.NewMockClock()

	strategy := queue.Strategy{WindowQuota: windowQuota, WindowSize: windowSize}
	queueKey := queue.QueueKey{RemedyName: "foo", Strategy: strategy}

	return &queueTestHarness{
		t:           t,
		strategy:    strategy,
		queueKey:    queueKey,
		windowQuota: windowQuota,
		TTL:         ttl,
		WindowSize:  windowSize,
		Clock:       clock,
		QueueSize:   queueSize,
	}
}

// WithRedisDPQ - sets test harness to use Redis DPQ
func (th *queueTestHarness) WithRedisDPQ() *queueTestHarness {
	redisKey := queue.BuildQueueRedisKey(th.queueKey)
	redisClient, redisSetTimeFunc := testutils.GetTestRedisClient(th.t, th.Clock)

	redisSetTimeFunc(th.Clock.Now())
	th.redisClient = redisClient
	th.redisSetTimeFunc = redisSetTimeFunc
	th.redisKey = redisKey

	dpq := queue.NewRedisDelayedPriorityQueue(
		th.queueKey,
		th.Clock,
		logging.ContextLogger{},
		*th.redisClient,
	)

	th.DPQ = dpq
	th.getDurationTillWindowEnd = func() time.Duration {
		timeTillEnd, err := th.redisClient.GetDurationTillWindowEnd(th.redisKey,
			th.WindowSize)
		require.NoError(th.t, err)
		return timeTillEnd
	}
	return th
}

// WithInMemoryDPQ - sets test harness to use InMemory DPQ
func (th *queueTestHarness) WithInMemoryDPQ() *queueTestHarness {
	dpq := queue.NewInMemoryDelayedPriorityQueue(
		th.queueKey,
		th.Clock,
		logging.ContextLogger{},
	)

	th.getDurationTillWindowEnd = dpq.GetTimeTillWindowEnd
	th.DPQ = dpq
	return th
}

// ValidateRequestInRedisDPQ validates if a request exists (or not exists) in the Redis DPQ.
// It checks if the request ID exists in the queue and compares it with the expected request ID.
// Parameters:
//   - exist: a boolean indicating whether the request should exist in the queue or not
//   - expectedReqID: the expected request ID to be found in the queue
func (th *queueTestHarness) ValidateRequestInRedisDPQ(exist bool, expectedReqID string, getCount int64) {
	members, err := th.redisClient.ZRange(th.redisKey, getCount, false)
	require.NoError(th.t, err)

	found := false
	for _, member := range members {
		reqData, err := queue.ExtractRequestData(member)
		require.NoError(th.t, err)
		if expectedReqID == reqData.RequestID {
			found = true
			break
		}
	}
	require.Equal(th.t, exist, found)
}

// PrepareQueueRequests creates multiple requests.
// Expects map where key is request ID and value its priority
func (th *queueTestHarness) PrepareQueueRequests(reqsData ...lo.Tuple2[string, float64]) {
	th.testRequests = nil
	for _, reqData := range reqsData {
		req := queue.NewRequest(reqData.A, reqData.B, th.Clock)
		th.Clock.AdvanceTime(time.Millisecond)
		th.testRequests = append(th.testRequests, req)
	}
}

func (th *queueTestHarness) GetTestRequest(reqID string) *queue.Request {
	for _, tr := range th.testRequests {
		if tr.ID == reqID {
			return tr
		}
	}
	th.t.Fatalf("Request with ID %s not found", reqID)
	return nil
}

// EnqueueRequests - asynchronously prepares enqueue specified requests.
// Actual enqueue will be started at the moment when `DispatchRequests` called
func (th *queueTestHarness) EnqueueRequests() {
	if th.resultsCh != nil {
		close(th.resultsCh)
	}

	th.resultsCh = make(chan enqueueResult, len(th.testRequests))
	var startChannels []chan struct{}
	for _, req := range th.testRequests {
		startCh := th.enqueue(req)
		startChannels = append(startChannels, startCh)
	}
	th.startDispatch = startChannels
}

// enqueue performs enqueue when signal received into startCh
func (th *queueTestHarness) enqueue(req *queue.Request) chan struct{} {
	startCh := make(chan struct{})
	go func() {
		<-startCh // Wait for a signal to start
		startTime := th.Clock.Now()
		log.Debug().Msgf("Request %s goes to Enqueue", req.ID)
		result, err := th.DPQ.Enqueue(req, th.TTL, th.QueueSize)
		if err != nil {
			log.Debug().Msgf("Error while processing request %s, runtime: %v, err: %s",
				req.ID,
				err,
				th.Clock.Now().Sub(startTime))
		}
		log.Debug().Msgf("Request %s processed, result %v, runtime: %v",
			req.ID,
			result,
			th.Clock.Now().Sub(startTime))

		th.resultsCh <- enqueueResult{
			finished:  true,
			id:        req.ID,
			result:    result,
			runtime:   th.Clock.Now().Sub(startTime),
			startTime: startTime,
		}
	}()

	return startCh
}

// DispatchRequests - gives signal to really start to Enqueue requests
func (th *queueTestHarness) DispatchRequests() {
	log.Debug().Msg("queueTestHarness: start dispatching requests")
	for i := 0; i < len(th.startDispatch); i++ {
		th.startDispatch[i] <- struct{}{}
		time.Sleep(time.Millisecond * 50)
	}
	log.Debug().Msg("queueTestHarness: requests dispatched")
}

// GatherResults - collects results of requests that were dispatched
func (th *queueTestHarness) GatherResults() map[string]enqueueResult {
	results := map[string]enqueueResult{}
	for i := 0; i < len(th.startDispatch); i++ {
		result := <-th.resultsCh
		results[result.id] = result
	}
	return results
}

// GetDurationTillWindowEnd returns duration till end of current window
// of the redis client
func (th *queueTestHarness) GetDurationTillWindowEnd() time.Duration {
	return th.getDurationTillWindowEnd()
}

// AdvanceTime - advanced mock clock of this test harness
func (th *queueTestHarness) AdvanceTime(duration time.Duration) {
	th.Clock.AdvanceTime(duration)
}

// AdvanceTimeToWindowSize - advanced mock clock of this test harness
func (th *queueTestHarness) AdvanceTimeToWindowSize() {
	th.Clock.AdvanceTime(th.WindowSize)
}

// AdvanceTimeToWindowStart - advanced mock clock to start of the window
func (th *queueTestHarness) AdvanceTimeToWindowStart() {
	sleepTimeTillWindow := th.GetDurationTillWindowEnd()
	th.Clock.AdvanceTime(sleepTimeTillWindow + AcceptableTimeDelta)
}

// AdvanceTimeBeforeWindowEnd - advanced mock clock to time before end of window
func (th *queueTestHarness) AdvanceTimeBeforeWindowEnd() {
	sleepTimeTillWindow := th.GetDurationTillWindowEnd()
	th.Clock.AdvanceTime(sleepTimeTillWindow - AcceptableTimeDelta)
}

// SetRedisClock - sets internal clock of redis client of this test harness
func (th *queueTestHarness) SetRedisClock(time time.Time) {
	th.redisSetTimeFunc(time)
}

// SetRedisClockDeltaFromNow sets internal Redis clock
// to be delta from current time
func (th *queueTestHarness) SetRedisClockDeltaFromNow(delta time.Duration) {
	th.SetRedisClock(th.Clock.Now().Add(delta))
}

// SyncRedisToWindowStart simulates time advance to the
// beginning of the window time. It works in sync with redis internal clock
func (th *queueTestHarness) SyncRedisToWindowStart() {
	sleepTimeTillWindow := th.GetDurationTillWindowEnd()

	// set Redis internal clock to point to the start of the next window
	th.SetRedisClockDeltaFromNow(sleepTimeTillWindow + AcceptableTimeDelta)

	// Simulate passing time in queue. At this point
	// Redis internal clock and queue processing window are sync
	th.AdvanceTime(sleepTimeTillWindow + AcceptableTimeDelta)
}
