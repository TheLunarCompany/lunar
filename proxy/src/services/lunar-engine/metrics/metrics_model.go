package metrics

type MetricValue struct {
	Name        Metric    `yaml:"name"`
	Description string    `yaml:"description"`
	Buckets     []float64 `yaml:"buckets,omitempty"`
	JSONPath    string    `yaml:"json_path,omitempty"`
}

type GeneralMetrics struct {
	LabelValue  []string      `yaml:"label_value"`
	MetricValue []MetricValue `yaml:"metric_value"`
}

type Config struct {
	GeneralMetrics   GeneralMetrics `yaml:"general_metrics"`
	SystemMetrics    []MetricValue  `yaml:"system_metrics"`
	LabeledEndpoints []string       `yaml:"labeled_endpoints"`
}
