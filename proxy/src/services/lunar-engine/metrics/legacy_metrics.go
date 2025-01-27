package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"lunar/engine/utils"
	"lunar/engine/utils/environment"
	"lunar/shared-model/config"
	"lunar/toolkit-core/otel"
	"os"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	sharedDiscovery "lunar/shared-model/discovery"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const (
	metricNameTransactionBucket = "lunar_transaction"
	metricsTimerInterval        = 5 * time.Second
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
	filePath                   string
	mu                         sync.Mutex

	metricsTimer      *time.Ticker
	bucketsBoundaries []float64

	// cache will be used instead of reading json file - if the file hasn't changed
	lastModTime time.Time
	cachedData  map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg
}

// NewLegacyMetricManager creates a new instance of LegacyMetricManager
func NewLegacyMetricManager(exportersConfig config.Exporters) (*LegacyMetricManager, error) {
	filePath := environment.GetDiscoveryStateLocation()
	if filePath == "" {
		return nil, fmt.Errorf("discovery state location not set")
	}

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
		filePath:          filePath,
		bucketsBoundaries: bucketBoundaries,
	}

	err := manager.initMetrics()
	if err != nil {
		return nil, err
	}

	// Start the metrics timer - will parse the JSON file and collect metrics
	manager.metricsTimer = time.NewTicker(metricsTimerInterval)
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
		metricNameTransactionBucket,
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

	endpointsData, originalData, err := m.readAndParseJSONFile()
	if err != nil {
		log.Error().Err(err).Msg("Failed to read and parse JSON file")
	}
	ctx := context.Background()
	for endpoint, endpointAgg := range endpointsData {
		for statusCode, count := range endpointAgg.StatusCodes {
			// Check if the data has changed
			if origAgg, ok := originalData[endpoint]; ok {
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

// readAndParseJSONFile reads and parses the JSON file
func (m *LegacyMetricManager) readAndParseJSONFile() (
	map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg, // new
	map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg, // original
	error,
) {
	// Get the file's modification time
	fileInfo, err := os.Stat(m.filePath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to stat JSON file: %w", err)
	}
	modTime := fileInfo.ModTime()

	// Check if the file has changed since the last read
	if modTime.Equal(m.lastModTime) && m.cachedData != nil {
		return m.cachedData, m.cachedData, nil
	}

	jsonFile, err := os.Open(filepath.Clean(m.filePath))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open JSON file: %w", err)
	}
	defer jsonFile.Close()

	byteValue, err := io.ReadAll(jsonFile)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read JSON file: %w", err)
	}

	var discoveryOutput sharedDiscovery.Output
	err = json.Unmarshal(byteValue, &discoveryOutput)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to unmarshal JSON data: %w", err)
	}

	parsedData := sharedDiscovery.ConvertEndpointsFromPersisted(discoveryOutput.Endpoints)

	// Update cache
	originalData := m.cachedData
	m.cachedData = parsedData
	m.lastModTime = modTime

	return parsedData, originalData, nil
}
