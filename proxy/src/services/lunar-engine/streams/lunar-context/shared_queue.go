package lunarcontext

import (
	"container/heap"
	"fmt"
	publictypes "lunar/engine/streams/public-types"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

type Item struct {
	value     string
	timestamp int64
	score     float64
}

type memoryQueue struct {
	queue PriorityQueue
	key   string
	mutex sync.RWMutex
}

func NewMemoryQueue(key string, _ time.Duration) publictypes.SharedQueueI {
	memoryQueue := &memoryQueue{
		key: fmt.Sprintf("%s%s", key, queueKeySuffix),
	}
	heap.Init(&memoryQueue.queue)
	return memoryQueue
}

func (q *memoryQueue) Enqueue(item string, priority float64) error {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	heap.Push(&q.queue, &Item{
		value:     item,
		score:     calculateScore(priority),
		timestamp: time.Now().UnixNano(),
	})
	return nil
}

func (q *memoryQueue) DequeueIfValueMatch(_ publictypes.SharedIsReqIDRelevant) string {
	q.mutex.Lock()
	defer q.mutex.Unlock()
	if q.queue.Len() == 0 {
		return ""
	}

	queueItem, valid := heap.Pop(&q.queue).(*Item)

	if !valid {
		log.Error().Msg("Could not cast priorityQueue item, " +
			"will not process")
		return ""
	}

	return queueItem.value
}

func (q *memoryQueue) Remove(item string) {
	q.mutex.Lock()
	defer q.mutex.Unlock()
	log.Error().Msg("Remove not implemented for memoryQueue")
	for i, v := range q.queue {
		if v.value == item {
			heap.Remove(&q.queue, i)
			return
		}
	}
}

func (q *memoryQueue) Size() int64 {
	q.mutex.RLock()
	defer q.mutex.RUnlock()

	return int64(q.queue.Len())
}

type PriorityQueue []*Item

func (pq PriorityQueue) Len() int { return len(pq) }

func (pq PriorityQueue) Less(i, j int) bool {
	if pq[i].score == pq[j].score {
		return pq[i].timestamp < pq[j].timestamp
	}
	return pq[i].score < pq[j].score
}

func (pq PriorityQueue) Swap(i, j int) { pq[i], pq[j] = pq[j], pq[i] }

func (pq *PriorityQueue) Push(x interface{}) {
	item, valid := x.(*Item)
	if !valid {
		log.Error().
			Msg("could not cast PriorityQueue item, will not push to queue")
		return
	}
	*pq = append(*pq, item)
}

func (pq *PriorityQueue) Pop() interface{} {
	old := *pq
	n := len(old)
	item := old[n-1]
	*pq = old[0 : n-1]
	return item
}
