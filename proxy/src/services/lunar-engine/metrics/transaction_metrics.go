package metrics

import (
	"context"
	"fmt"
	"lunar/engine/utils"
	"lunar/engine/utils/environment"
	"strconv"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"

	sharedDiscovery "lunar/shared-model/discovery"
)

type transactionMetricsManager struct {
	supportedLabels          map[string]string
	transactionMetricObjects map[string]metric.Float64Histogram

	mu sync.Mutex

	metricsTimer *time.Ticker

	discoveryParser *discoveryStateParser
}

func newTransactionMetricsManager(
	meter metric.Meter,
	metricConfig *Config,
	labels map[string]string,
) (*transactionMetricsManager, error) {
	mng := &transactionMetricsManager{
		supportedLabels:          labels,
		transactionMetricObjects: make(map[string]metric.Float64Histogram),
		mu:                       sync.Mutex{},
	}

	err := mng.initMetrics(meter, metricConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize transaction metrics: %w", err)
	}

	if len(mng.transactionMetricObjects) == 0 {
		log.Info().Msg("No transaction metrics to initialize")
		return mng, nil
	}

	mng.discoveryParser, err = newDiscoveryStateParser()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize discovery state parser: %w", err)
	}

	// Start the metrics timer - will parse the JSON file and collect metrics
	mng.metricsTimer = time.NewTicker(environment.GetAccessLogMetricsCollectTimeInterval())
	go func() {
		for range mng.metricsTimer.C {
			mng.collectMetrics()
		}
	}()

	log.Info().Msg("TransactionMetricsManager initialized")
	return mng, nil
}

func (m *transactionMetricsManager) initMetrics(meter metric.Meter, metricConfig *Config) error {
	for _, metricDef := range metricConfig.GeneralMetrics.MetricValue {
		var buckets []float64
		if metricDef.Name == TransactionDuration ||
			metricDef.Name == ProviderTransactionDuration {
			buckets = metricDef.Buckets
			if len(buckets) == 0 {
				log.Debug().Msgf("No explicit bucket boundaries for %v", metricDef.Name)
				buckets = defaultBucketBoundaries
			}

			log.Debug().Msgf("Creating %v meter with bucket boundaries: %v", metricDef.Name, buckets)

			transactionBucketMetricObj, err := meter.Float64Histogram(
				MetricPrefix+string(metricDef.Name),
				metric.WithDescription(metricDef.Description),
				metric.WithExplicitBucketBoundaries(buckets...),
			)
			if err != nil {
				log.Error().Err(err).Msgf("Failed to create %v histogram meter", metricDef.Name)
				return err
			}
			m.transactionMetricObjects[string(metricDef.Name)] = transactionBucketMetricObj
		}
	}
	return nil
}

func (m *transactionMetricsManager) loadLabels(
	endpoint sharedDiscovery.Endpoint,
	consumerTag string,
	statusCode int,
) []attribute.KeyValue {
	var labels []attribute.KeyValue
	for label := range m.supportedLabels {
		value := ""
		switch label {
		case HTTPMethod:
			value = endpoint.Method
		case URL:
			value = endpoint.URL
		case Host:
			value = utils.ExtractHost(endpoint.URL)
		case StatusCode:
			if statusCode != 0 {
				value = strconv.Itoa(statusCode)
			}
		case ConsumerTag:
			if consumerTag != "-" {
				value = consumerTag
			}
		}

		if value != "" {
			labels = append(labels, attribute.String(label, value))
		}
	}

	return labels
}

func (m *transactionMetricsManager) publishMetricValue(
	metricName Metric,
	value float32,
	labels []attribute.KeyValue,
) {
	if metricObj, exists := m.transactionMetricObjects[string(metricName)]; exists {
		ctx := context.Background()
		metricObj.Record(ctx, float64(value), metric.WithAttributes(labels...))
	}
}

func (m *transactionMetricsManager) collectMetrics() {
	m.mu.Lock()
	defer m.mu.Unlock()

	data, err := m.discoveryParser.ReadAndParseDiscovery()
	if err != nil {
		log.Error().Err(err).Msg("Failed to read and parse JSON file")
		return
	}
	for consumer, endpointMap := range data.NewConsumerData {
		for endpoint, endpointAgg := range endpointMap {
			for statusCode := range endpointAgg.StatusCodes {
				// Check if the data has not changed
				if origConsumer, ok := data.OriginalConsumerData[consumer]; ok {
					if origAgg, ok := origConsumer[endpoint]; ok {
						if origAgg.AverageDuration == endpointAgg.AverageDuration &&
							origAgg.AverageTotalDuration == endpointAgg.AverageTotalDuration {
							continue
						}
					}
				}

				labels := m.loadLabels(endpoint, consumer, statusCode)

				m.publishMetricValue(ProviderTransactionDuration, endpointAgg.AverageDuration, labels)
				m.publishMetricValue(TransactionDuration, endpointAgg.AverageTotalDuration, labels)
			}
		}
	}
}
