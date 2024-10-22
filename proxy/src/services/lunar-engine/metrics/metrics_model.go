package metrics

type MetricValue struct {
	Name     Metric     `yaml:"name"`
	Type     MetricType `yaml:"type"`
	JSONPath string     `yaml:"json_path,omitempty"`
}

type GeneralMetrics struct {
	LabelValue  []string      `yaml:"label_value"`
	MetricValue []MetricValue `yaml:"metric_value"`
}

type Config struct {
	GeneralMetrics GeneralMetrics `yaml:"general_metrics"`
	SystemMetrics  []MetricValue  `yaml:"system_metrics"`
}
