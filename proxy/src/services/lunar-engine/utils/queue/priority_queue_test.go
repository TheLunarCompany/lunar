package queue_test

import (
	"container/heap"
	"lunar/engine/utils/queue"
	"lunar/toolkit-core/clock"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestItReturnFIFOWithinSamePriority(t *testing.T) {
	mockClock := clock.NewMockClock()
	priorityQueue := queue.PriorityQueue{}
	heap.Init(&priorityQueue)
	reqA := queue.NewRequest("A", 1, mockClock)
	heap.Push(&priorityQueue, reqA)

	mockClock.AdvanceTime(time.Millisecond)

	reqB := queue.NewRequest("B", 1, mockClock)
	heap.Push(&priorityQueue, reqB)

	first := heap.Pop(&priorityQueue).(*queue.Request)
	second := heap.Pop(&priorityQueue).(*queue.Request)

	assert.Equal(t, first, reqA)
	assert.Equal(t, second, reqB)
}

func TestItReturnHigherPriorityFirstForRequestsWithTheSameTimestamp(
	t *testing.T,
) {
	mockClock := clock.NewMockClock()
	priorityQueue := queue.PriorityQueue{}
	heap.Init(&priorityQueue)
	reqA := queue.NewRequest("A", 2, mockClock)
	heap.Push(&priorityQueue, reqA)

	// Since we don't advance the time, both requests will have the same timestamp.
	// However, reqB is still practically added after reqA.
	reqB := queue.NewRequest("B", 1, mockClock)
	heap.Push(&priorityQueue, reqB)

	first := heap.Pop(&priorityQueue).(*queue.Request)
	second := heap.Pop(&priorityQueue).(*queue.Request)

	assert.Equal(t, first, reqB)
	assert.Equal(t, second, reqA)
}

func TestItReturnHigherPriorityFirstEvenIfAddedLater(t *testing.T) {
	mockClock := clock.NewMockClock()
	priorityQueue := queue.PriorityQueue{}
	heap.Init(&priorityQueue)
	reqA := queue.NewRequest("A", 2, mockClock)
	heap.Push(&priorityQueue, reqA)

	mockClock.AdvanceTime(time.Millisecond)
	reqB := queue.NewRequest("B", 1, mockClock)
	heap.Push(&priorityQueue, reqB)

	first := heap.Pop(&priorityQueue).(*queue.Request)
	second := heap.Pop(&priorityQueue).(*queue.Request)

	assert.Equal(t, first, reqB)
	assert.Equal(t, second, reqA)
}

func TestItDoesNotPushItemToQueueIfNotARequest(t *testing.T) {
	priorityQueue := queue.PriorityQueue{}
	heap.Init(&priorityQueue)
	reqA := "not a request struct"
	heap.Push(&priorityQueue, reqA)

	assert.Equal(t, 0, priorityQueue.Len())
}
