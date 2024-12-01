package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"lunar/engine/utils/environment"
	"os"
	"strconv"
	"sync"

	sharedDiscovery "lunar/shared-model/discovery"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

type apiCallCountMetricManager struct {
	supportedLabels      map[string]string
	mu                   sync.Mutex
	apiCallCountObserver metric.Int64ObservableCounter
}

func newAPICallMetricManager(
	meter metric.Meter,
	labels map[string]string,
) (*apiCallCountMetricManager, error) {
	mng := &apiCallCountMetricManager{
		mu:              sync.Mutex{},
		supportedLabels: labels,
	}
	meterObj, err := meter.Int64ObservableCounter(
		string(APICallCountMetric),
		metric.WithDescription("The number of API calls"),
		metric.WithInt64Callback(mng.apiCallCountCallback),
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create API calls count observer")
		return nil, err
	}

	mng.apiCallCountObserver = meterObj
	return mng, nil
}

func (md *apiCallCountMetricManager) apiCallCountCallback(
	_ context.Context,
	observer metric.Int64Observer,
) error {
	md.mu.Lock()
	defer md.mu.Unlock()

	metrics, err := loadAPICallMetrics(md.supportedLabels)
	if err != nil {
		log.Error().Err(err).Msg("failed to load APICallMetrics")
		return err
	}

	for _, apiCallMetric := range metrics {
		observer.Observe(apiCallMetric.Count, metric.WithAttributes(apiCallMetric.Labels...))
	}
	return nil
}

type apiCallCountMetric struct {
	Count  int64
	Labels []attribute.KeyValue
}

type apiCallMetricData struct {
	Labels  map[string]sharedDiscovery.APICallsMetric
	Metrics map[string]int64
}

func getLabelValue(label string, metric sharedDiscovery.APICallsMetric) string {
	switch label {
	case HTTPMethod:
		return metric.Method
	case URL:
		return metric.URL
	case Host:
		return metric.Host
	case StatusCode:
		if metric.StatusCode != 0 {
			return strconv.Itoa(metric.StatusCode)
		}
	case ConsumerTag:
		if metric.ConsumerTag != "-" {
			return metric.ConsumerTag
		}
	}
	return ""
}

// loadAPICallMetrics loads the APICallMetrics from the state file
func loadAPICallMetrics(supportedLabels map[string]string) ([]apiCallCountMetric, error) {
	content, err := os.ReadFile(environment.GetAPICallsMetricsStateLocation())
	if err != nil {
		return nil, fmt.Errorf("failed to read APICallMetricsState file: %w", err)
	}
	apiCallMetricData := &apiCallMetricData{}
	err = json.Unmarshal(content, apiCallMetricData)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal APICallMetricData: %w", err)
	}

	var metrics []apiCallCountMetric
	for hash, count := range apiCallMetricData.Metrics {
		var labels []attribute.KeyValue

		if _, ok := apiCallMetricData.Labels[hash]; ok {
			for label := range supportedLabels {
				labelValue := getLabelValue(label, apiCallMetricData.Labels[hash])
				if labelValue != "" {
					labels = append(labels, attribute.String(label, labelValue))
				}
			}
		}
		labels = appendGatewayIDAttribute(labels)

		metric := apiCallCountMetric{
			Count:  count,
			Labels: labels,
		}
		metrics = append(metrics, metric)
	}
	return metrics, nil
}
