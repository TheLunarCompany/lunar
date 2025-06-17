package metrics

import (
	"context"
	"fmt"
	"lunar/toolkit-core/otel"
	"sync"

	"go.opentelemetry.io/otel/attribute"
	"golang.org/x/exp/slices"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/metric"
)

type MetricManager struct {
	config           *Config
	meter            metric.Meter
	metricObjects    map[Metric]interface{}
	generalMetricReg metric.Registration
	systemMetricReg  metric.Registration

	labelManager                  *LabelManager
	apiCallMetricMng              *apiCallCountMetricManager
	transactionMetricsManager     *transactionMetricsManager
	remainingConnectionsMetricMng *remainingConnectionsMetricManager
	providerData                  *metricsProviderData

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

	labeledEndpointMng := NewLabeledEndpointManager(config.LabeledEndpoints)
	mng := &MetricManager{
		config:        config,
		meter:         meter,
		metricObjects: make(map[Metric]interface{}),
		providerData:  newMetricsProviderData(),
		labelManager: NewLabelManager(config.GeneralMetrics.LabelValue).
			WithLabeledEndpointManager(labeledEndpointMng),
	}

	// api call count metric - special treatment
	mng.apiCallMetricMng, err = newAPICallMetricManager(meter, mng.labelManager)
	if err != nil {
		return &MetricManager{}, fmt.Errorf("failed to initialize APICallCountMetric: %w", err)
	}

	mng.remainingConnectionsMetricMng, err = newRemainingConnectionsMetricManager(meter)
	if err != nil {
		return mng, fmt.Errorf("failed to initialize remaining connections metric: %w", err)
	}

	mng.transactionMetricsManager, err = newTransactionMetricsManager(meter, config, mng.labelManager)
	if err != nil {
		return mng, fmt.Errorf("failed to initialize transaction metrics: %w", err)
	}

	// general metrics
	if err := mng.initializeGeneralMetrics(); err != nil {
		return mng, fmt.Errorf("failed to initialize general metrics: %w", err)
	}

	// system metrics
	if err := mng.initializeSystemMetrics(); err != nil {
		return mng, fmt.Errorf("failed to initialize system metrics: %w", err)
	}

	mng.metricManagerActive = true
	log.Info().Msg("Metrics manager initialized")
	return mng, nil
}

func (m *MetricManager) ReloadMetricsConfig() error {
	log.Info().Msg("Reloading metrics config")
	m.mu.Lock()
	defer m.mu.Unlock()

	config, err := loadMetricsConfig()
	if err != nil {
		log.Error().Err(err).Msg("failed to get metrics config")
		return err
	}

	if m.config == nil {
		m.metricManagerActive = true
		m.config = config
		log.Info().Msg("Metrics manager reloaded")
		return nil
	}

	if !slices.Equal(config.GeneralMetrics.LabelValue, m.config.GeneralMetrics.LabelValue) {
		log.Info().Msg("Reloading labels")
		m.labelManager.SetLabels(config.GeneralMetrics.LabelValue)
	}

	if !config.EqualLabeledEndpoints(m.config) {
		log.Info().Msg("Reloading labeled endpoints")
		m.labelManager.labeledEndpointMng.SetLabeledEndpoints(config.LabeledEndpoints)
	}

	if !config.GeneralMetrics.Equal(m.config.GeneralMetrics) {
		log.Info().Msg("Reloading general metrics")
		if err = m.initializeGeneralMetrics(); err != nil {
			return fmt.Errorf("failed to initialize general metrics: %w", err)
		}
	}

	if !config.EqualSystemMetrics(*m.config) {
		log.Info().Msg("Reloading system metrics")
		if err = m.initializeSystemMetrics(); err != nil {
			return fmt.Errorf("failed to initialize system metrics: %w", err)
		}
	}

	m.metricManagerActive = true
	log.Info().Msg("Metrics manager reloaded")
	return nil
}

// UpdateMetricsForAPICall updates the general metrics - relevant for the API calls
func (m *MetricManager) UpdateMetricsForAPICall(provider APICallMetricsProviderI) {
	if !m.metricManagerActive {
		return
	}

	if provider.GetType().IsResponseType() {
		m.providerData.UpdateAPICallData(provider)
	}
}

// UpdateMetricsForFlow updates the system metrics - relevant for the flows
func (m *MetricManager) UpdateMetricsForFlow(provider FlowMetricsProviderI) {
	if !m.metricManagerActive {
		return
	}
	if m.providerData == nil {
		m.providerData = newMetricsProviderData()
	}

	m.providerData.UpdateFlowData(provider)
}

// initializeMetrics initializes the metrics by parsing
func (m *MetricManager) initializeMetrics(metrics []MetricValue) ([]metric.Observable, error) {
	log.Info().Msgf("Initializing metrics: %+v", metrics)

	var meterObjs []metric.Observable
	for _, metricValue := range metrics {
		if _, ok := accessLogBasedMetrics[metricValue.Name]; ok {
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

	activeFlowsData := data.GetActiveFlows()
	for _, flowName := range activeFlowsData.ActiveFlows {
		attr := attribute.String(FlowName, flowName)
		if err := observeMetric(m, ActiveFlowsMetric, 1, observer, attr); err != nil {
			log.Trace().Err(err).Msgf("Failed to observe %v for flow %s", ActiveFlowsMetric, flowName)
		}
	}

	flowInvocationsData := data.GetFlowInvocations()
	for flowName, flowData := range flowInvocationsData.FlowInvocations {
		for _, labelSet := range flowData.GetLabels() {
			attributes := buildAttributesFromLabelSet(flowName, labelSet)
			if err := observeMetric(m, FlowsInvocationsMetric, 1, observer, attributes...); err != nil {
				log.Trace().Err(err).Msgf("Failed to observe %v", FlowsInvocationsMetric)
			}
		}
	}

	requestsThroughData := data.GetRequestsThroughFlows()
	for _, labelSet := range requestsThroughData.RequestsThroughFlows.GetLabels() {
		attributes := buildAttributesFromLabelSet("", labelSet)
		if err := observeMetric(m, RequestsThroughFlowsMetric, 1, observer, attributes...); err != nil {
			log.Trace().Err(err).Msgf("Failed to observe %v", RequestsThroughFlowsMetric)
		}
	}

	avgFlowExecutionData := data.GetAvgFlowExecutionTime()
	for flowName, executionTime := range avgFlowExecutionData.AvgFlowExecutionTime {
		flowData := avgFlowExecutionData.FlowInvocations[flowName]
		if flowData == nil {
			continue
		}

		for _, labelSet := range flowData.GetLabels() {
			attributes := buildAttributesFromLabelSet(flowName, labelSet)
			if err := observeMetric(m, AvgFlowExecutionTimeMetric, executionTime,
				observer, attributes...); err != nil {
				log.Trace().Err(err).Msgf("Failed to observe %v, flow %s", AvgFlowExecutionTimeMetric, flowName)
			}
		}
	}

	procExecutionData := data.GetProcessorExecutionData()
	for processorKey, procData := range procExecutionData.ProcExecutionData {
		for _, executionData := range procData.Executions {
			attributes := buildAttributesFromLabelSet(executionData.FlowName, *executionData.ReqLabelSet)
			attributes = append(attributes, attribute.String(ProcessorKey, processorKey))

			if err := observeMetric(m, AvgProcessorExecutionTimeMetric, procData.AvgExecutionTime,
				observer, attributes...); err != nil {
				log.Trace().
					Err(err).
					Msgf("Failed to observe %v, processor %s", AvgProcessorExecutionTimeMetric, processorKey)
			}

			attributes = append(attributes, attribute.Bool(Success, executionData.Success))
			if err := observeMetric(m, ProcessorInvocation, 1, observer, attributes...); err != nil {
				log.Trace().
					Err(err).
					Msgf("Failed to observe %v, processor %s", ProcessorInvocation, processorKey)
			}
		}
	}

	return nil
}

func observeMetric[T int | int64 | float64](
	mng *MetricManager,
	metricName Metric,
	value T,
	observer metric.Observer,
	attributes ...attribute.KeyValue,
) error {
	meterObjRaw, found := mng.metricObjects[metricName]
	if !found {
		return fmt.Errorf("metric %s not found", metricName)
	}

	attributes = appendGatewayIDAttribute(attributes)

	switch meterObj := meterObjRaw.(type) {
	case metric.Float64ObservableCounter, metric.Float64ObservableUpDownCounter, metric.Float64ObservableGauge: //nolint:lll
		if observable, ok := meterObj.(metric.Float64Observable); ok {
			observer.ObserveFloat64(observable, float64(value), metric.WithAttributes(attributes...))
		} else {
			log.Error().Msgf("metric %s is not a Float64Observable", metricName)
		}
	case metric.Int64ObservableUpDownCounter, metric.Int64ObservableCounter, metric.Int64ObservableGauge: //nolint:lll
		if observable, ok := meterObj.(metric.Int64Observable); ok {
			observer.ObserveInt64(observable, int64(value), metric.WithAttributes(attributes...))
		} else {
			log.Error().Msgf("metric %s is not an Int64Observable", metricName)
		}
	default:
		log.Error().Msgf("unsupported metric type for %s", metricName)
	}
	return nil
}

func (m *MetricManager) initializeGeneralMetrics() error {
	meterObjs, err := m.initializeMetrics(m.config.GeneralMetrics.MetricValue)
	if err != nil {
		return err
	}

	if m.generalMetricReg != nil {
		_ = m.generalMetricReg.Unregister()
	}
	m.generalMetricReg, err = m.meter.RegisterCallback(m.observeGeneralMetrics, meterObjs...)
	if err != nil {
		return err
	}
	return nil
}

func (m *MetricManager) initializeSystemMetrics() error {
	meterObjs, err := m.initializeMetrics(m.config.SystemMetrics)
	if err != nil {
		return fmt.Errorf("failed to initialize system metrics: %w", err)
	}

	if m.systemMetricReg != nil {
		_ = m.systemMetricReg.Unregister()
	}
	m.systemMetricReg, err = m.meter.RegisterCallback(m.observeSystemMetrics, meterObjs...)
	if err != nil {
		return err
	}
	return nil
}

func buildAttributesFromLabelSet(flowName string, labelSet LabelSet) []attribute.KeyValue {
	var attributes []attribute.KeyValue
	if flowName != "" {
		attributes = addAttribute(FlowName, flowName, attribute.String, attributes)
	}

	attributes = addAttribute(Host, labelSet.Host, attribute.String, attributes)
	attributes = addAttribute(HTTPMethod, labelSet.Method, attribute.String, attributes)
	attributes = addAttribute(ConsumerTag, labelSet.Consumer, attribute.String, attributes)

	return attributes
}

func addAttribute[T int | string](
	key string,
	value T,
	addFunc func(key string, value T) attribute.KeyValue,
	attributes []attribute.KeyValue,
) []attribute.KeyValue {
	var isZero bool
	switch v := any(value).(type) {
	case string:
		isZero = v == ""
	case int:
		isZero = v == 0
	default:
		isZero = false
	}
	if !isZero {
		attributes = append(attributes, addFunc(key, value))
	}
	return attributes
}
