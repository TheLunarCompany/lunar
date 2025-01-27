package quotaresource

import (
	streamconfig "lunar/engine/streams/config"
)

// revive:disable-next-line:exported
type QuotaResourceData struct {
	Quotas         []*QuotaConfig      `yaml:"quotas"          validate:"dive,required"`
	InternalLimits []*ChildQuotaConfig `yaml:"internal_limits" validate:"dive"`
}

type SingleQuotaResourceData struct {
	Quota          *QuotaConfig
	InternalLimits []*ChildQuotaConfig
}

type QuotaConfig struct {
	ID       string               `yaml:"id"       validate:"required"`
	Filter   *streamconfig.Filter `yaml:"filter"`
	Strategy *StrategyConfig      `yaml:"strategy" validate:"required"`
}

type ChildQuotaConfig struct {
	QuotaConfig `       yaml:",inline"`
	ParentID    string `yaml:"parent_id" validate:"required"`
}

type StrategyConfig struct {
	FixedWindow              *FixedWindowConfig              `yaml:"fixed_window"`
	FixedWindowCustomCounter *FixedWindowCustomCounterConfig `yaml:"fixed_window_custom_counter"`
	Concurrent               *ConcurrentConfig               `yaml:"concurrent"`
	HeaderBased              *HeaderBasedConfig              `yaml:"header_based"`
	AllocationPercentage     int64                           `yaml:"allocation_percentage,omitempty" validate:"gt=-1,lte=100"` //nolint:lll
}

type FixedWindowCustomCounterConfig struct {
	FixedWindowConfig `       yaml:",inline"`
	CounterValuePath  string `yaml:"counter_value_path" validate:"required"`
}

type FixedWindowConfig struct {
	QuotaLimit     `                    yaml:",inline"`
	GroupByHeader  string              `yaml:"group_by_header,omitempty"`
	MonthlyRenewal *MonthlyRenewalData `yaml:"monthly_renewal,omitempty"`
}

type HeaderBasedConfig struct {
	QuotaHeader      string `yaml:"quota_header"`
	ResetHeader      string `yaml:"reset_header,omitempty"`
	RetryAfterHeader string `yaml:"retry_after_header,omitempty"`
}

type ConcurrentConfig struct {
	MaxRequestCount int64 `yaml:"max_request_count"`
}

type MonthlyRenewalData struct {
	Day      int    `yaml:"day"      validate:"gt=0,lte=31"`
	Hour     int    `yaml:"hour"     validate:"gte=0,lte=23"`
	Minute   int    `yaml:"minute"   validate:"gte=0,lte=59"`
	Timezone string `yaml:"timezone" validate:"oneof=UTC Local"`
}

type Spillover struct {
	Max int64 `yaml:"max" validate:"required,gt=0"`
}

type QuotaLimit struct {
	Max          int64      `yaml:"max"                 validate:"required,gt=0"`
	Interval     int64      `yaml:"interval"            validate:"required,gt=0"`
	IntervalUnit string     `yaml:"interval_unit"       validate:"oneof=second minute hour day month"` //nolint:lll
	Spillover    *Spillover `yaml:"spillover,omitempty"`
}
