package limit

import (
	"lunar/engine/utils"
	"time"
)

type RequestArguments struct {
	RequestScope  utils.Scope
	Grouping      Grouping
	GroupID       GroupID
	Method        string
	NormalizedURL string
}

type RateLimitState interface {
	Increment(requestArgs RequestArguments, windowSize time.Duration) (int, error)
}
