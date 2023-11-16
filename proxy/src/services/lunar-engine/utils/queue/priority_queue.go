package queue

import (
	"lunar/toolkit-core/clock"
	"time"

	"github.com/rs/zerolog/log"
)

type PriorityQueue []*Request

func (pq PriorityQueue) Len() int { return len(pq) }

func (pq PriorityQueue) Less(i, j int) bool {
	if pq[i].priority == pq[j].priority {
		return pq[i].timestamp.Before(pq[j].timestamp)
	}
	return pq[i].priority < pq[j].priority
}

func (pq PriorityQueue) Swap(i, j int) { pq[i], pq[j] = pq[j], pq[i] }

func (pq *PriorityQueue) Push(x interface{}) {
	item, valid := x.(*Request)
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

type Request struct {
	ID        string
	priority  int
	timestamp time.Time
	doneCh    chan struct{}
}

func NewRequest(id string, priority int, clock clock.Clock) *Request {
	return &Request{
		ID:        id,
		priority:  priority,
		timestamp: clock.Now(),
		doneCh:    make(chan struct{}),
	}
}
