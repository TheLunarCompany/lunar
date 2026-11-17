package queue

import (
	"time"
)

type DelayedPriorityQueueable interface {
	Enqueue(*Request, time.Duration, int64) (bool, error)
	Counts() map[float64]int64
}

type Strategy struct {
	WindowQuota int64
	WindowSize  time.Duration
}
type QueueKey struct { //nolint: revive
	RemedyName string
	Strategy   Strategy
}
