package metrics

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"lunar/engine/utils/environment"
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
	metricNameTransactionCount = "lunar_transaction_count"
	metricNameTransactionSum   = "lunar_transaction_sum"
)

type LegacyMetricManager struct {
	meter                       metric.Meter
	transactionCountObserver    metric.Int64ObservableCounter
	transactionDurationObserver metric.Float64ObservableCounter
	observableRegistration      metric.Registration
	filePath                    string
	mu                          sync.Mutex

	// cache will be used instead of reading json file - if the file hasn't changed
	lastModTime time.Time
	cachedData  map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg
}

// NewLegacyMetricManager creates a new instance of LegacyMetricManager
func NewLegacyMetricManager() (*LegacyMetricManager, error) {
	filePath := environment.GetDiscoveryStateLocation()
	if filePath == "" {
		return nil, fmt.Errorf("discovery state location not set")
	}

	manager := &LegacyMetricManager{
		meter:    otel.GetMeter(),
		filePath: filePath,
	}

	// Initialize the observable counters
	err := manager.initMetrics()
	if err != nil {
		return nil, err
	}

	log.Info().Msg("LegacyMetricManager initialized")
	return manager, nil
}

// initMetrics initializes the metrics
func (m *LegacyMetricManager) initMetrics() (err error) {
	m.transactionCountObserver, err = m.meter.Int64ObservableCounter(
		metricNameTransactionCount,
		metric.WithDescription("The number of transactions that have passed through Lunar Proxy"),
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create transaction count observer")
		return err
	}

	m.transactionDurationObserver, err = m.meter.Float64ObservableCounter(
		metricNameTransactionSum,
		metric.WithDescription("Sum of transaction durations"),
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create transaction duration observer")
		return err
	}

	// Register the single callback for the metrics
	m.observableRegistration, err = m.meter.RegisterCallback(
		m.collectMetrics,
		m.transactionCountObserver,
		m.transactionDurationObserver,
	)
	if err != nil {
		log.Error().Err(err).Msg("Failed to register metric callback")
		return err
	}
	return nil
}

// collectMetrics is the callback function that collects and reports the metrics
func (m *LegacyMetricManager) collectMetrics(_ context.Context, observer metric.Observer) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	endpointsData, err := m.readAndParseJSONFile()
	if err != nil {
		return err
	}

	for endpoint, endpointAgg := range endpointsData {
		for statusCode, count := range endpointAgg.StatusCodes {
			labels := []attribute.KeyValue{
				attribute.String("method", endpoint.Method),
				attribute.String("normalized_url", endpoint.URL),
				attribute.String("status_code", strconv.Itoa(statusCode)),
			}

			// cumulative transaction count
			observer.ObserveInt64(m.transactionCountObserver, int64(count), metric.WithAttributes(labels...))

			// Calculate total duration (average_duration * count)
			totalDuration := float64(endpointAgg.AverageDuration) * float64(count)

			// cumulative transaction duration
			observer.ObserveFloat64(m.transactionDurationObserver,
				totalDuration,
				metric.WithAttributes(labels...),
			)
		}
	}
	return nil
}

// readAndParseJSONFile reads and parses the JSON file
func (m *LegacyMetricManager) readAndParseJSONFile() (
	map[sharedDiscovery.Endpoint]sharedDiscovery.EndpointAgg,
	error,
) {
	// Get the file's modification time
	fileInfo, err := os.Stat(m.filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat JSON file: %w", err)
	}
	modTime := fileInfo.ModTime()

	// Check if the file has changed since the last read
	if modTime.Equal(m.lastModTime) && m.cachedData != nil {
		return m.cachedData, nil
	}

	jsonFile, err := os.Open(filepath.Clean(m.filePath))
	if err != nil {
		return nil, fmt.Errorf("failed to open JSON file: %w", err)
	}
	defer jsonFile.Close()

	byteValue, err := io.ReadAll(jsonFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read JSON file: %w", err)
	}

	var discoveryOutput sharedDiscovery.Output
	err = json.Unmarshal(byteValue, &discoveryOutput)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal JSON data: %w", err)
	}

	parsedData := sharedDiscovery.ConvertEndpointsFromPersisted(discoveryOutput.Endpoints)

	// Update cache
	m.cachedData = parsedData
	m.lastModTime = modTime

	return parsedData, nil
}
