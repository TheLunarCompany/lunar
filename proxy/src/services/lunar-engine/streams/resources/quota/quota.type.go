package quotaresource

import (
	streamconfig "lunar/engine/streams/config"
)

type QuotaMetaData struct {
	ID       string
	Filter   *streamconfig.Filter
	Strategy *Strategy
}

type UsedStrategy int

const (
	FixedWindowStrategy UsedStrategy = iota
	ConcurrentStrategy
	HeaderBasedStrategy
)

type GroupByType int

const (
	GroupByProcessorParam GroupByType = iota
	GroupByHeader
)
