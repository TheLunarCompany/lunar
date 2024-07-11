package quotaresource

import streamconfig "lunar/engine/streams/config"

type QuotaResourceData struct { //nolint: revive
	Type   string                `yaml:"type"`
	Quotas []QuotaRepresentation `yaml:"quotas"`
}

type QuotaRepresentation struct {
	ID       string              `yaml:"id"`
	Filter   streamconfig.Filter `yaml:"filter"`
	Strategy Strategy            `yaml:"strategy"`
}
type Strategy struct {
	FixedWindow *FixedWindowConfig `yaml:"fixed_window"`
	Concurrent  *ConcurrentConfig  `yaml:"concurrent"`
	HeaderBased *HeaderBasedConfig `yaml:"header_based"`
}

type FixedWindowConfig struct {
	AllowedRequestsCount int    `yaml:"allowed_requests_count"`
	WindowSizeSeconds    int    `yaml:"window_size_seconds"`
	Group                *Group `yaml:"group"`
}

type HeaderBasedConfig struct {
	QuotaHeader      string `yaml:"quota_header"`
	ResetHeader      string `yaml:"reset_header,omitempty"`
	RetryAfterHeader string `yaml:"retry_after_header,omitempty"`
}

type ConcurrentConfig struct {
	MaxRequestsCount int `yaml:"max_requests_count"`
}

type QuotaAllocation struct {
	GroupName            string  `yaml:"group_name"`
	AllocationPercentage float64 `yaml:"allocation_percentage" validate:"gte=0"`
}

type Group struct {
	GroupBy string            `yaml:"group_by"` // This should be either "processor_param" or "header"
	Groups  []QuotaAllocation `yaml:"groups"`
}
