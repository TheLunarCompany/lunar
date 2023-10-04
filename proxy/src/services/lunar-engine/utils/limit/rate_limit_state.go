package limit

import (
	"time"
)

type RequestArguments struct {
	LimiterID string
	Grouping  Grouping
	GroupID   GroupID
}

type IncrementableRateLimitState interface {
	Increment(
		requestArgs RequestArguments,
		windowSize time.Duration,
	) (int, error)
}
