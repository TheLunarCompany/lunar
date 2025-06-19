package metrics

import (
	"context"
	"fmt"
	"lunar/toolkit-core/haproxy"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const haproxySocketPath = "/var/run/haproxy/haproxy.sock"

type remainingConnectionsMetricManager struct {
	haproxy    *haproxy.Stats
	observer   metric.Int64ObservableGauge
	attributes []attribute.KeyValue
}

func newRemainingConnectionsMetricManager(
	meter metric.Meter,
) (*remainingConnectionsMetricManager, error) {
	mng := &remainingConnectionsMetricManager{
		attributes: []attribute.KeyValue{},
	}

	if err := mng.init(meter); err != nil {
		return nil, fmt.Errorf("failed to initialize remaining connections metric manager: %w", err)
	}

	log.Debug().Msg("Remaining connections metric manager created successfully")
	return mng, nil
}

func (m *remainingConnectionsMetricManager) remainingConnectionsCallback(
	_ context.Context,
	observer metric.Int64Observer,
) error {
	remainingConns, err := m.haproxy.QueryRemainingConnections()
	if err != nil {
		return err
	}

	observer.Observe(
		int64(remainingConns),
		metric.WithAttributes(m.attributes...),
	)

	return nil
}

func (m *remainingConnectionsMetricManager) init(meter metric.Meter) error {
	haproxyClient, err := haproxy.NewHAProxyStatsClient(haproxySocketPath)
	if err != nil {
		return fmt.Errorf("failed to create HAProxy stats client: %w", err)
	}

	m.haproxy = haproxyClient
	m.attributes = appendGatewayIDAttribute(m.attributes)
	m.observer, err = meter.Int64ObservableGauge(
		MetricPrefix+string(RemainingConnectionsMetric),
		metric.WithDescription("The number of remaining connections in the pool"),
		metric.WithInt64Callback(m.remainingConnectionsCallback),
	)
	if err != nil {
		return err
	}

	log.Debug().Msg("Remaining connections metric manager initialized successfully")
	return nil
}
