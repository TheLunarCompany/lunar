package metrics

type MetricValue struct {
	Name        Metric    `yaml:"name"`
	Description string    `yaml:"description"`
	Buckets     []float64 `yaml:"buckets,omitempty"`
	JSONPath    string    `yaml:"json_path,omitempty"`
}

// Equal compares two MetricValue structs.
func (m MetricValue) Equal(other MetricValue) bool {
	if m.Name != other.Name || m.Description != other.Description || m.JSONPath != other.JSONPath {
		return false
	}

	if len(m.Buckets) != len(other.Buckets) {
		return false
	}
	for i := range m.Buckets {
		if m.Buckets[i] != other.Buckets[i] {
			return false
		}
	}

	return true
}

type GeneralMetrics struct {
	LabelValue  []string      `yaml:"label_value"`
	MetricValue []MetricValue `yaml:"metric_value"`
}

// Equal compares two GeneralMetrics structs.
func (g GeneralMetrics) Equal(other GeneralMetrics) bool {
	if len(g.LabelValue) != len(other.LabelValue) {
		return false
	}
	for i := range g.LabelValue {
		if g.LabelValue[i] != other.LabelValue[i] {
			return false
		}
	}

	if len(g.MetricValue) != len(other.MetricValue) {
		return false
	}
	for i := range g.MetricValue {
		if !g.MetricValue[i].Equal(other.MetricValue[i]) {
			return false
		}
	}

	return true
}

type Config struct {
	GeneralMetrics GeneralMetrics `yaml:"general_metrics"`
	SystemMetrics  []MetricValue  `yaml:"system_metrics"`
}

// EqualSystemMetrics compares only the SystemMetrics slice in Config.
func (c Config) EqualSystemMetrics(other Config) bool {
	if len(c.SystemMetrics) != len(other.SystemMetrics) {
		return false
	}
	for i := range c.SystemMetrics {
		if !c.SystemMetrics[i].Equal(other.SystemMetrics[i]) {
			return false
		}
	}
	return true
}
