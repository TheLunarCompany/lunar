//go:build pro

package queue_test

import (
	"testing"

	"github.com/samber/lo"
	"github.com/stretchr/testify/require"
)

func TestDelayedPriorityQueueProcessesRequestImmediately(t *testing.T) {
	qtHar := newQueueTestHarness(t, 250, 1000).WithInMemoryDPQ()

	qtHar.PrepareQueueRequests(newReqData("A", 1))
	qtHar.EnqueueRequests()
	qtHar.DispatchRequests()

	results := qtHar.GatherResults()
	require.True(t, results["A"].result)
	// Req A should be processed immediately
	require.LessOrEqual(t, results["A"].runtime, AcceptableTimeDelta)
}

func TestDelayedPriorityQueueProcessesRequestImmediatelyInSubsequentWindow(
	t *testing.T,
) {
	qtHar := newQueueTestHarness(t, 250, 1000).WithInMemoryDPQ()

	qtHar.PrepareQueueRequests(newReqData("A", 1))
	qtHar.EnqueueRequests()
	qtHar.DispatchRequests()

	results := qtHar.GatherResults()
	require.True(t, results["A"].result)
	// Req A should be processed immediately
	require.LessOrEqual(t, results["A"].runtime, AcceptableTimeDelta)

	// Now, let's repeat it with request B
	qtHar.AdvanceTimeToWindowSize()
	qtHar.PrepareQueueRequests(newReqData("B", 1))
	qtHar.EnqueueRequests()
	qtHar.DispatchRequests()

	results = qtHar.GatherResults()
	require.True(t, results["B"].result)
	// Req B should be processed immediately
	require.LessOrEqual(t, results["B"].runtime, AcceptableTimeDelta)
}

func TestDelayedQueueReturnsCorrectCountOfRequestsInQueue(t *testing.T) {
	qtHar := newQueueTestHarness(t, 250, 250).WithInMemoryDPQ()

	qtHar.PrepareQueueRequests(
		newReqData("A", 1),
		newReqData("B", 1))

	qtHar.EnqueueRequests()
	qtHar.AdvanceTimeBeforeWindowEnd()
	qtHar.DispatchRequests()

	counts := qtHar.DPQ.Counts()
	require.Equal(t, 1, counts[1], "unexpected number of requests")
}

func TestDelayedQueueReturnsCorrectCountOfRequestsInQueueGroupedByPriority(t *testing.T) { //nolint:lll
	qtHar := newQueueTestHarness(t, 250, 1000).WithInMemoryDPQ()

	qtHar.PrepareQueueRequests(
		newReqData("A", 1),
		newReqData("B", 1),
		newReqData("C", 2),
		newReqData("D", 3))

	qtHar.EnqueueRequests()
	qtHar.AdvanceTimeBeforeWindowEnd()
	qtHar.DispatchRequests()

	counts := qtHar.DPQ.Counts()
	require.Equal(t, 1, counts[1], "unexpected number of requests")
	require.Equal(t, 1, counts[2], "unexpected number of requests")
	require.Equal(t, 1, counts[3], "unexpected number of requests")
}

func TestDelayedPriorityQueueProcessesRequestAtALaterWindow(t *testing.T) {
	qtHar := newQueueTestHarness(t, 250, 1000).WithInMemoryDPQ()

	reqData := []lo.Tuple2[string, float64]{
		newReqData("A", 1),
		newReqData("B", 1),
		newReqData("C", 1),
	}
	qtHar.PrepareQueueRequests(reqData...)
	qtHar.EnqueueRequests()
	qtHar.DispatchRequests()

	// simulate time advance for 2 non-immediate requests
	for i := 0; i < len(reqData); i++ {
		qtHar.AdvanceTimeToWindowSize()
	}

	// finally,  gather results
	results := qtHar.GatherResults()

	// all requests should be given a green light (return `true`)
	require.True(t, results["A"].result)
	require.True(t, results["B"].result)
	require.True(t, results["C"].result)

	// Req A should be processed immediately
	require.LessOrEqual(t, results["A"].runtime, AcceptableTimeDelta)

	// Req B should be processed before Req C
	require.LessOrEqual(t, results["B"].runtime, results["C"].runtime)
}

func TestDelayedPriorityQueueReturnsFalseForRequestWhichTTLs(t *testing.T) {
	qtHar := newQueueTestHarness(t, 250, 250).WithInMemoryDPQ()

	qtHar.PrepareQueueRequests(
		newReqData("A", 1),
		newReqData("B", 1),
		newReqData("C", 1))

	qtHar.EnqueueRequests()
	qtHar.DispatchRequests()

	// Simulate passing time - so B will start processing
	qtHar.AdvanceTimeToWindowStart()
	// Simulate another passing time - so last request will be thrown out
	qtHar.AdvanceTime(qtHar.WindowSize)

	// finally,  gather results
	results := qtHar.GatherResults()

	// the first two requests can be processed within TTL time
	require.True(t, results["A"].result)
	require.True(t, results["B"].result)
	// the third request can not be processed before it TTLs
	require.False(t, results["C"].result)

	// Req A should be processed immediately
	require.LessOrEqual(t, results["A"].runtime, AcceptableTimeDelta)

	// Req B should be processed before Req C
	require.LessOrEqual(t, results["B"].runtime, results["C"].runtime)
}

func TestDelayedPriorityQueueProcessesNonImmediateRequestAccordingToPriority(t *testing.T) { //nolint:lll
	qtHar := newQueueTestHarness(t, 250, 1000).WithInMemoryDPQ()

	reqData := []lo.Tuple2[string, float64]{
		newReqData("A", 1),
		newReqData("B", 2),
		newReqData("C", 1),
	}
	qtHar.PrepareQueueRequests(reqData...)

	qtHar.EnqueueRequests()
	qtHar.DispatchRequests()

	// simulate time advance for 2 non-immediate requests
	for i := 0; i < len(reqData); i++ {
		qtHar.AdvanceTimeToWindowSize()
	}

	// finally,  gather results
	results := qtHar.GatherResults()

	// all requests should be given a green light (return `true`)
	require.True(t, results["A"].result)
	require.True(t, results["B"].result)
	require.True(t, results["C"].result)

	// Req A should be processed immediately
	require.LessOrEqual(t, results["A"].runtime, AcceptableTimeDelta)

	// Req C should be processed before Req B
	require.LessOrEqual(t, results["C"].runtime, results["B"].runtime)
}

func TestDelayedPriorityQueueTTLsRequestIfHigherPriorityRequestTakesItsPlace(t *testing.T) { //nolint:lll
	qtHar := newQueueTestHarness(t, 250, 250).WithInMemoryDPQ()

	reqData := []lo.Tuple2[string, float64]{
		newReqData("A", 1),
		newReqData("B", 2),
		newReqData("C", 1),
	}
	qtHar.PrepareQueueRequests(reqData...)

	qtHar.EnqueueRequests()
	qtHar.DispatchRequests()

	// simulate time advance for 2 non-immediate requests
	for i := 0; i < len(reqData); i++ {
		qtHar.AdvanceTimeToWindowSize()
	}

	// finally,  gather results
	results := qtHar.GatherResults()

	// only requests A & C should be given a green light (return `true`)
	require.True(t, results["A"].result)
	require.False(t, results["B"].result)
	require.True(t, results["C"].result)

	// Req A should be processed immediately
	require.LessOrEqual(t, results["A"].runtime, AcceptableTimeDelta)

	// Req C should be processed before Req B
	require.LessOrEqual(t, results["C"].runtime, results["B"].runtime)
}
