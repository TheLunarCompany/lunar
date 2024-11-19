package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"lunar/engine/utils/environment"
	"os"
	"strconv"
	"sync"
	"time"

	sharedDiscovery "lunar/shared-model/discovery"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const FileLoadFrequency = 15 * time.Second

type apiCallCountMetricManager struct {
	meterObj              metric.Float64Counter
	counterPreviousValues map[string]int64 // map of hash -> count
	supportedLabels       map[string]string
	ticker                *time.Ticker
	mu                    sync.Mutex
}

func newAPICallCountMetricManager(
	meter metric.Meter,
	labels map[string]string,
) (*apiCallCountMetricManager, error) {
	meterObj, err := meter.Float64Counter(
		string(APICallCountMetric),
		metric.WithDescription("User defined counter metric"),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create counter metric: %w", err)
	}

	mng := &apiCallCountMetricManager{
		mu:                    sync.Mutex{},
		meterObj:              meterObj,
		supportedLabels:       labels,
		counterPreviousValues: make(map[string]int64),
		ticker:                time.NewTicker(FileLoadFrequency),
	}

	go mng.tickerHandler()

	return mng, nil
}

func (md *apiCallCountMetricManager) tickerHandler() {
	for range md.ticker.C {
		metrics, err := loadAPICallMetrics(md.supportedLabels)
		if err != nil {
			log.Error().Err(err).Msg("failed to load APICallMetrics")
			continue
		}
		md.updateAPICallMetrics(metrics)
	}
}

func (md *apiCallCountMetricManager) updateAPICallMetrics(metrics []apiCallCountMetric) {
	md.mu.Lock()
	defer md.mu.Unlock()

	ctx := context.Background()
	for _, apiCallMetric := range metrics {
		previousCount := md.counterPreviousValues[apiCallMetric.ID]
		if previousCount == apiCallMetric.Count {
			continue // no need to update the metric
		}

		md.counterPreviousValues[apiCallMetric.ID] = apiCallMetric.Count
		newCount := apiCallMetric.Count - previousCount

		md.meterObj.Add(ctx, float64(newCount), metric.WithAttributes(apiCallMetric.Labels...))
	}
}

type apiCallCountMetric struct {
	ID     string
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
	case StatusCode:
		return strconv.Itoa(metric.StatusCode)
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
			ID:     hash,
			Count:  count,
			Labels: labels,
		}
		metrics = append(metrics, metric)
	}
	return metrics, nil
}
