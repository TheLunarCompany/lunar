package metrics

import (
	"bytes"
	"errors"
	"fmt"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"
	"strings"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/metric"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/common/expfmt"
)

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

// Equal compares two GeneralMetrics structs.
func (g GeneralMetrics) Equal(other GeneralMetrics) bool {
	if len(g.LabelValue) != len(other.LabelValue) {
		return false
	}
	if len(g.MetricValue) != len(other.MetricValue) {
		return false
	}

	for i := range g.LabelValue {
		if g.LabelValue[i] != other.LabelValue[i] {
			return false
		}
	}

	for i := range g.MetricValue {
		if !g.MetricValue[i].Equal(other.MetricValue[i]) {
			return false
		}
	}

	return true
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

func (c Config) EqualLabeledEndpoints(other *Config) bool {
	if len(c.LabeledEndpoints) != len(other.LabeledEndpoints) {
		return false
	}
	for i := range c.LabeledEndpoints {
		if c.LabeledEndpoints[i] != other.LabeledEndpoints[i] {
			return false
		}
	}
	return true
}

// registerObservableMetric registers an observable metric with the given meter
func registerObservableMetric(
	meter metric.Meter,
	metricVal MetricValue,
) (meterObj metric.Observable, err error) {
	metricType, found := metricsObservableRegistry[metricVal.Name]
	if !found {
		return nil, fmt.Errorf("type unknown for metric: %s", metricVal.Name)
	}

	metricName := string(metricVal.Name)
	description := metric.WithDescription(metricVal.Description)

	switch metricType { //nolint:exhaustive
	case Int64ObservableCounter:
		meterObj, err = meter.Int64ObservableCounter(metricName, description)
	case Float64ObservableCounter:
		meterObj, err = meter.Float64ObservableCounter(metricName, description)
	case Int64ObservableUpDownCounter:
		meterObj, err = meter.Int64ObservableUpDownCounter(metricName, description)
	case Float64ObservableUpDownCounter:
		meterObj, err = meter.Float64ObservableUpDownCounter(metricName, description)
	case Int64ObservableGauge:
		meterObj, err = meter.Int64ObservableGauge(metricName, description)
	case Float64ObservableGauge:
		meterObj, err = meter.Float64ObservableGauge(metricName, description)
	default:
		return nil, fmt.Errorf("unknown metric type: %v", metricType)
	}
	return meterObj, err
}

// loadMetricsConfig loads and returns the metrics config
func loadMetricsConfig() (*Config, error) {
	log.Info().Msg("Loading metrics config")
	configFilePath := environment.GetMetricsConfigFilePath()

	log.Info().Msgf("Metrics config file path: %s", configFilePath)
	result, err := configuration.DecodeYAML[Config](configFilePath)
	if err != nil {
		return nil, err
	}
	if len(result.Content) == 0 {
		return nil, errors.New("metrics config file is empty")
	}
	return result.UnmarshaledData, nil
}

func GatherLunarMetrics() (string, error) {
	mfs, err := prometheus.DefaultGatherer.Gather()
	if err != nil {
		return "", fmt.Errorf("error gathering metrics: %w", err)
	}

	var buf bytes.Buffer
	enc := expfmt.NewEncoder(&buf, expfmt.FmtText)
	for _, mf := range mfs {
		if isMetricLunarRelated(mf.GetName()) {
			if err := enc.Encode(mf); err != nil {
				return "", fmt.Errorf("error encoding metrics: %w", err)
			}
		}
	}

	return buf.String(), nil
}

func isMetricLunarRelated(metricName string) bool {
	if strings.HasPrefix(metricName, MetricPrefix) {
		return true
	}

	for _, label := range labelsToInclude {
		if strings.Contains(metricName, label) {
			return true
		}
	}
	return false
}
