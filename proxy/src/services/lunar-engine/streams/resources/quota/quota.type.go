package quotaresource

import (
	"errors"
	"fmt"
	streamconfig "lunar/engine/streams/config"
	publictypes "lunar/engine/streams/public-types"
	resourcetypes "lunar/engine/streams/resources/types"
	resourceutils "lunar/engine/streams/resources/utils"
	"time"
)

type ResourceAdmI interface {
	publictypes.QuotaResourceI
	GetSystemFlow() *resourcetypes.ResourceFlowData
	GetGroupedBy() string
	GetID() string
	GetLimit() int64
	GetQuotaGroupsCounters() map[string]int64
}

type QuotaAdmI interface {
	GetMetaData() *SingleQuotaResourceData
	GetQuota(string) (publictypes.QuotaResourceI, error)
	GetIDs() []string
	GetSystemFlow() map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation
	Update(metadata *SingleQuotaResourceData) error
}

type QuotaMetaData struct {
	ID       string
	Filter   *streamconfig.Filter
	Strategy *StrategyConfig
}

type UsedStrategy int

const (
	FixedWindowStrategy UsedStrategy = iota
	FixedWindowCustomCounterStrategy
	ConcurrentStrategy
	HeaderBasedStrategy
)

type GroupByType int

const (
	GroupByProcessorParam GroupByType = iota
	GroupByHeader
)

// IsValid function to validate UsedStrategy
func (us UsedStrategy) IsValid() error {
	switch us {
	case FixedWindowStrategy,
		FixedWindowCustomCounterStrategy,
		ConcurrentStrategy,
		HeaderBasedStrategy:
		return nil
	default:
		return errors.New("invalid UsedStrategy")
	}
}

// CreateStrategy function to create Strategy
func (us UsedStrategy) CreateStrategy(providerCfg *QuotaConfig) (ResourceAdmI, error) {
	switch us {
	case FixedWindowStrategy, FixedWindowCustomCounterStrategy:
		return NewFixedStrategy(providerCfg, nil)
	case ConcurrentStrategy:
		return NewConcurrentStrategy(providerCfg, nil)
	case HeaderBasedStrategy:
		return NewHeaderBasedStrategy(providerCfg, nil)
	default:
		return nil, errors.New("invalid Strategy")
	}
}

// CreateStrategy function to create Strategy
func (us UsedStrategy) CreateChildStrategy(
	providerCfg *QuotaConfig,
	parent *resourceutils.QuotaNode[ResourceAdmI],
) (ResourceAdmI, error) {
	switch us {
	case FixedWindowStrategy, FixedWindowCustomCounterStrategy:
		return NewFixedStrategy(providerCfg, parent)
	case ConcurrentStrategy:
		return NewConcurrentStrategy(providerCfg, parent)
	case HeaderBasedStrategy:
		return NewHeaderBasedStrategy(providerCfg, parent)
	default:
		return nil, errors.New("invalid Strategy")
	}
}

// IsValid function to validate QuotaMetaData
func (qmd *QuotaMetaData) IsValid() error {
	if qmd.ID == "" {
		return errors.New("quota ID is empty")
	}
	if qmd.Filter == nil {
		return errors.New("quota filter is nil")
	}
	if qmd.Strategy == nil {
		return errors.New("quota strategy is nil")
	}
	return nil
}

// GetUsedStrategy function to get UsedStrategy
func (s *StrategyConfig) GetUsedStrategy() UsedStrategy {
	if s.FixedWindow != nil {
		return FixedWindowStrategy
	}
	if s.FixedWindowCustomCounter != nil {
		return FixedWindowCustomCounterStrategy
	}
	if s.Concurrent != nil {
		return ConcurrentStrategy
	}
	if s.HeaderBased != nil {
		return HeaderBasedStrategy
	}
	return -1
}

type TimeUnit string

var DefaultGroup = "default"

const (
	Second TimeUnit = "second"
	Minute TimeUnit = "minute"
	Hour   TimeUnit = "hour"
	Day    TimeUnit = "day"
	Month  TimeUnit = "month"
)

func (fw *FixedWindowConfig) IsMonthlyRenewalSet() bool {
	return fw.MonthlyRenewal != nil
}

func (ql *QuotaLimit) GetIntervalType() TimeUnit {
	return TimeUnit(ql.IntervalUnit)
}

func (fw *FixedWindowConfig) GetGroup() string {
	if fw.GroupByHeader == "" {
		return DefaultGroup
	}
	return fw.GroupByHeader
}

func (ql *QuotaLimit) ParseWindow() time.Duration {
	switch ql.GetIntervalType() {
	case Second:
		return time.Duration(ql.Interval) * time.Second
	case Minute:
		return time.Duration(ql.Interval) * time.Minute
	case Hour:
		return time.Duration(ql.Interval) * time.Hour
	case Day:
		return time.Duration(ql.Interval) * 24 * time.Hour
	case Month:
		return time.Duration(ql.Interval) * 30 * 24 * time.Hour
	default:

		panic(fmt.Errorf("invalid interval type: %s", ql.GetIntervalType()))
	}
}
