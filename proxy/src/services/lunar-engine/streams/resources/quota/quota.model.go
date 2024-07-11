package quotaresource

type Strategy struct {
	FixedWindow *FixedWindowConfig
	Concurrent  *ConcurrentConfig
	HeaderBased *HeaderBasedConfig
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
