package metrics

import (
	"context"
	"fmt"
	"sync"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/metric"
)

type apiCallCountMetricManager struct {
	mu                   sync.Mutex
	apiCallCountObserver metric.Int64ObservableCounter
	labelManager         *LabelManager
	discoveryParser      *discoveryStateParser
}

func newAPICallMetricManager(
	meter metric.Meter,
	labelManager *LabelManager,
) (*apiCallCountMetricManager, error) {
	mng := &apiCallCountMetricManager{
		mu:           sync.Mutex{},
		labelManager: labelManager,
	}

	var err error
	mng.discoveryParser, err = newDiscoveryStateParser()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize discovery state parser: %w", err)
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

func (m *apiCallCountMetricManager) apiCallCountCallback(
	_ context.Context,
	observer metric.Int64Observer,
) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	return m.collectMetrics(observer)
}

func (m *apiCallCountMetricManager) collectMetrics(observer metric.Int64Observer) error {
	data, err := m.discoveryParser.ReadAndParseDiscovery()
	if err != nil {
		log.Error().Err(err).Msg("Failed to read and parse JSON file")
		return err
	}
	for consumer, endpointMap := range data.NewConsumerData {
		for endpoint, endpointAgg := range endpointMap {
			for statusCode, count := range endpointAgg.StatusCodes {
				labels := m.labelManager.GetAttributesFromDiscoveryEndpoint(endpoint, consumer, statusCode)
				observer.Observe(int64(count), metric.WithAttributes(labels...))
			}
		}
	}
	return nil
}
