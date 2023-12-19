package queue

import (
	"time"
)

type DelayedPriorityQueueable interface {
	Enqueue(*Request, time.Duration) (bool, error)
	Counts() map[float64]int
}

type Strategy struct {
	WindowQuota int64
	WindowSize  time.Duration
}
type QueueKey struct { //nolint: revive
	RemedyName string
	Strategy   Strategy
}
