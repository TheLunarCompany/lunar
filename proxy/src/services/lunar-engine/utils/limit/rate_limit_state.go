package limit

import (
	"errors"
	"time"
)

var (
	errLimiterIDMissing = errors.New("LimiterID must be specified")
	errGroupIDMissing   = errors.New("GroupID must be specified for a grouped state") //nolint:lll
)

type (
	GroupID      = string
	Grouping     int
	CurrentState int
)

const (
	Grouped Grouping = iota
	Ungrouped
)

const (
	Block CurrentState = iota
	Proceed
)

type CurrentLimitState struct {
	NewCounter int64
	LimitSate  CurrentState
}

const (
	UngroupedLimit  = "ungroupedLimit"
	rateLimitPrefix = "lunar_rate_limit"
)

type RequestArguments struct {
	LimiterID string
	Grouping  Grouping
	GroupID   GroupID
}

type WindowData struct {
	WindowSize          time.Duration
	MaxAllowedInWindows int64
}

type IncrementableRateLimitState interface {
	TryToIncrement(
		requestArgs RequestArguments,
		windowSize WindowData,
	) (CurrentLimitState, error)
	Counters() map[RequestArguments]int64
}

func validateLimitKeys(requestArgs RequestArguments) error {
	if requestArgs.LimiterID == "" {
		return errLimiterIDMissing
	}

	if requestArgs.Grouping == Grouped && requestArgs.GroupID == "" {
		return errGroupIDMissing
	}

	return nil
}
