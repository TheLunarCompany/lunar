package metrics

import (
	"context"
	"lunar/engine/utils"
	"lunar/engine/utils/environment"
	"lunar/shared-model/config"
	"lunar/toolkit-core/otel"
	"strconv"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const (
	legacyMetricNameTransaction = "lunar_transaction"
)

// These are the default bucket boundaries that will be used in histograms
// in case no explicit bucket boundaries were supplied via config
var defaultBucketBoundaries = []float64{
	100,
	200,
	500,
	750,
	1000,
	2000,
	5000,
	10000,
}

type LegacyMetricManager struct {
	meter                      metric.Meter
	transactionBucketMetricObj metric.Int64Histogram
	mu                         sync.Mutex

	metricsTimer      *time.Ticker
	bucketsBoundaries []float64

	discoveryParser *discoveryStateParser
}

// NewLegacyMetricManager creates a new instance of LegacyMetricManager
func NewLegacyMetricManager(exportersConfig config.Exporters) (*LegacyMetricManager, error) {
	prometheusConfig := config.PrometheusConfig{}
	if exportersConfig.Prometheus != nil {
		prometheusConfig = *exportersConfig.Prometheus
	}
	bucketBoundaries := prometheusConfig.BucketBoundaries
	if len(bucketBoundaries) == 0 {
		log.Info().Msgf("No explicit bucket boundaries, using default: %v", defaultBucketBoundaries)
		bucketBoundaries = defaultBucketBoundaries
	}

	manager := &LegacyMetricManager{
		meter:             otel.GetMeter(),
		bucketsBoundaries: bucketBoundaries,
	}

	err := manager.initMetrics()
	if err != nil {
		return nil, err
	}

	manager.discoveryParser, err = newDiscoveryStateParser()
	if err != nil {
		return nil, err
	}

	// Start the metrics timer - will parse the JSON file and collect metrics
	manager.metricsTimer = time.NewTicker(environment.GetAccessLogMetricsCollectTimeInterval())
	go func() {
		for range manager.metricsTimer.C {
			manager.collectMetrics()
		}
	}()

	log.Info().Msg("LegacyMetricManager initialized")
	return manager, nil
}

// initMetrics initializes the metrics
func (m *LegacyMetricManager) initMetrics() (err error) {
	m.transactionBucketMetricObj, err = m.meter.Int64Histogram(
		legacyMetricNameTransaction,
		metric.WithDescription(
			"Histogram (& derived counter) of transactions runtime. "+
				"Global by host, Endpoint by normalized URL.",
		),
		metric.WithExplicitBucketBoundaries(m.bucketsBoundaries...),
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create transaction bucket observer")
		return err
	}
	return nil
}

// collectMetrics is the callback function that collects and reports the metrics
func (m *LegacyMetricManager) collectMetrics() {
	m.mu.Lock()
	defer m.mu.Unlock()

	data, err := m.discoveryParser.ReadAndParseDiscovery()
	if err != nil {
		log.Error().Err(err).Msg("Failed to read and parse JSON file")
		return
	}
	ctx := context.Background()
	for endpoint, endpointAgg := range data.NewEndpointData {
		for statusCode, count := range endpointAgg.StatusCodes {
			// Check if the data has changed
			if origAgg, ok := data.OriginalEndpointData[endpoint]; ok {
				if originalCount := origAgg.StatusCodes[statusCode]; count > originalCount {
					labels := []attribute.KeyValue{
						// Bilt uses host as normalized_url (discussed with Gabbay)
						attribute.String("normalized_url", utils.ExtractHost(endpoint.URL)),
						attribute.String("method", endpoint.Method),
						attribute.String("status_code", strconv.Itoa(statusCode)),
					}

					// we measure durations in legacy code /lunar-engine/services/exporters/prometheus_exporter.go
					duration := int64(endpointAgg.AverageDuration)
					numberOfRecords := int(count - originalCount)
					// Update histogram number of times based on counts - it will be the same as number of records
					for i := 0; i < numberOfRecords; i++ {
						m.transactionBucketMetricObj.Record(ctx, duration, metric.WithAttributes(labels...))
					}
				}
			}
		}
	}
}
