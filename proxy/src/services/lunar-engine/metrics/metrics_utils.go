package metrics

import (
	"errors"
	"fmt"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/configuration"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/metric"
)

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
