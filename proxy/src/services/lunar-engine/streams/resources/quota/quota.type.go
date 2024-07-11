package quotaresource

type QuotaMetaData struct {
	ID       string
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
