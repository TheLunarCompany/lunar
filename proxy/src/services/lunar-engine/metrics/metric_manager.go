package metrics

import (
	"context"
	"fmt"
	"lunar/toolkit-core/otel"
	"sync"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/metric"
)

type MetricManager struct {
	config           *Config
	meter            metric.Meter
	metricObjects    map[Metric]interface{}
	generalMetricReg metric.Registration
	systemMetricReg  metric.Registration

	labelManager     *LabelManager
	apiCallMetricMng *apiCallCountMetricManager
	providerData     *metricsProviderData

	metricManagerActive bool

	mu sync.Mutex
}

func NewMetricManager() (*MetricManager, error) {
	log.Info().Msg("Initializing metrics manager")
	meter := otel.GetMeter()
	config, err := loadMetricsConfig()
	if err != nil {
		log.Error().Err(err).Msg("failed to get metrics config")
		return &MetricManager{}, err
	}
	mng := &MetricManager{
		config:        config,
		meter:         meter,
		metricObjects: make(map[Metric]interface{}),
		labelManager:  NewLabelManager(config.GeneralMetrics.LabelValue),
		providerData:  newMetricsProviderData(),
	}

	// api call count metric - special treatment
	mng.apiCallMetricMng, err = newAPICallMetricManager(meter, mng.labelManager.labelsMap)
	if err != nil {
		return &MetricManager{}, fmt.Errorf("failed to initialize APICallCountMetric: %w", err)
	}

	// general metrics
	meterObjs, err := mng.initializeMetrics(mng.config.GeneralMetrics.MetricValue)
	if err != nil {
		return &MetricManager{}, fmt.Errorf("failed to initialize metrics: %w", err)
	}

	mng.generalMetricReg, err = mng.meter.RegisterCallback(mng.observeGeneralMetrics, meterObjs...)
	if err != nil {
		return &MetricManager{}, err
	}

	// system metrics
	meterObjs, err = mng.initializeMetrics(mng.config.SystemMetrics)
	if err != nil {
		return &MetricManager{}, fmt.Errorf("failed to initialize system metrics: %w", err)
	}

	mng.systemMetricReg, err = mng.meter.RegisterCallback(mng.observeSystemMetrics, meterObjs...)
	if err != nil {
		return &MetricManager{}, err
	}

	mng.metricManagerActive = true
	log.Info().Msg("Metrics manager initialized")
	return mng, nil
}

// UpdateMetricsForAPICall updates the general metrics - relevant for the API calls
func (m *MetricManager) UpdateMetricsForAPICall(provider APICallMetricsProviderI) {
	if !m.metricManagerActive {
		log.Warn().Msg("metric manager is not active")
		return
	}

	if provider.GetType().IsRequestType() {
		m.labelManager.UpdateRequestConsumerTag(provider)
	} else {
		m.providerData.UpdateAPICallData(provider)
	}
}

// UpdateMetricsForFlow updates the system metrics - relevant for the flows
func (m *MetricManager) UpdateMetricsForFlow(provider FlowMetricsProviderI) {
	if !m.metricManagerActive {
		log.Warn().Msg("metric manager is not active")
		return
	}

	m.providerData.UpdateFlowData(provider)
}

// initializeMetrics initializes the metrics by parsing
func (m *MetricManager) initializeMetrics(metrics []MetricValue) ([]metric.Observable, error) {
	log.Info().Msgf("Initializing metrics: %+v", metrics)

	var meterObjs []metric.Observable
	for _, metricValue := range metrics {
		if metricValue.Name == APICallCountMetric {
			continue
		}

		meterObj, err := registerObservableMetric(m.meter, metricValue)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize general metric %s: %w", metricValue.Name, err)
		}
		meterObjs = append(meterObjs, meterObj)
		m.metricObjects[metricValue.Name] = meterObj
	}
	return meterObjs, nil
}

func (m *MetricManager) observeGeneralMetrics(_ context.Context, observer metric.Observer) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	err := observeMetric(m, APICallSizeMetric, m.providerData.GetAvgAPICallSize(), observer)
	if err != nil {
		return err
	}

	return nil
}

func (m *MetricManager) observeSystemMetrics(_ context.Context, observer metric.Observer) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	data := m.providerData.GetFlowData()
	if err := observeMetric(m, ActiveFlowsMetric, data.GetActiveFlows(), observer); err != nil {
		log.Error().Err(err).Msgf("Failed to observe %v", ActiveFlowsMetric)
	}

	if err := observeMetric(m, FlowsInvocationsMetric,
		data.GetFlowInvocations(), observer); err != nil {
		log.Error().Err(err).Msgf("Failed to observe %v", FlowsInvocationsMetric)
	}

	if err := observeMetric(m, RequestsThroughFlowsMetric,
		data.GetRequestsThroughFlows(), observer); err != nil {
		log.Error().Err(err).Msgf("Failed to observe %v", RequestsThroughFlowsMetric)
	}

	if err := observeMetric(m, AvgFlowExecutionTimeMetric,
		data.GetAvgFlowExecutionTime(), observer); err != nil {
		log.Error().Err(err).Msgf("Failed to observe %v", AvgFlowExecutionTimeMetric)
	}

	if err := observeMetric(m, AvgProcessorExecutionTimeMetric,
		data.GetAvgProcessorExecutionTime(), observer); err != nil {
		log.Error().Err(err).Msgf("Failed to observe %v", AvgProcessorExecutionTimeMetric)
	}

	return nil
}

func observeMetric[T int64 | float64](
	mng *MetricManager,
	metricName Metric,
	value T,
	observer metric.Observer,
) error {
	meterObjRaw, found := mng.metricObjects[metricName]
	if !found {
		return fmt.Errorf("metric %s not found", metricName)
	}

	switch meterObj := meterObjRaw.(type) {
	case metric.Float64ObservableCounter, metric.Float64ObservableUpDownCounter, metric.Float64ObservableGauge: //nolint:lll
		if observable, ok := meterObj.(metric.Float64Observable); ok {
			observer.ObserveFloat64(observable, float64(value), withGatewayIDAttribute())
		} else {
			log.Error().Msgf("metric %s is not a Float64Observable", metricName)
		}
	case metric.Int64ObservableUpDownCounter, metric.Int64ObservableCounter, metric.Int64ObservableGauge: //nolint:lll
		if observable, ok := meterObj.(metric.Int64Observable); ok {
			observer.ObserveInt64(observable, int64(value), withGatewayIDAttribute())
		} else {
			log.Error().Msgf("metric %s is not an Int64Observable", metricName)
		}
	default:
		log.Error().Msgf("unsupported metric type for %s", metricName)
	}
	return nil
}
