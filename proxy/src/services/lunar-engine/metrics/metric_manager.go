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
	config *Config
	meter  metric.Meter

	// observable metrics
	metricObjects sync.Map // key - Metric, value - metric.Observable

	// regular metrics
	flowsInvocationsCounter     metric.Int64Counter
	requestsThroughFlowsCounter metric.Int64Counter

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
		metricObjects: sync.Map{},
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

// UpdateMetricsProviderForAPICall updates the metrics provider for API call-related metrics
func (m *MetricManager) UpdateMetricsProviderForAPICall(provider APICallMetricsProviderI) {
	if !m.metricManagerActive {
		return
	}

	if provider.GetType().IsResponseType() {
		m.providerData.UpdateAPICallData(provider)
	}
}

// UpdateMetricsProviderForFlow updates the metrics provider for flow-related metrics
func (m *MetricManager) UpdateMetricsProviderForFlow(provider FlowMetricsProviderI) {
	if !m.metricManagerActive {
		return
	}
	if m.providerData == nil {
		m.providerData = newMetricsProviderData()
	}

	provider.RegisterFlowInvocationsObserver(m.observeFlowInvocations)
	provider.RegisterRequestsThroughFlowsObserver(m.observeRequestsThroughFlows)
	m.providerData.UpdateFlowDataProvider(provider)
}

// initializeObservableMetrics initializes the metrics by parsing
func (m *MetricManager) initializeObservableMetrics(metrics []MetricValue) (
	[]metric.Observable,
	error,
) {
	log.Info().Msgf("Initializing metrics: %+v", metrics)

	var meterObjs []metric.Observable
	for _, metricValue := range metrics {
		if _, ok := accessLogBasedMetrics[metricValue.Name]; ok {
			continue
		}

		meterObj, err := registerObservableMetric(m.meter, metricValue)
		if err != nil {
			return nil, fmt.Errorf("failed to initialize metric %s: %w", metricValue.Name, err)
		}
		meterObjs = append(meterObjs, meterObj)
		m.metricObjects.Store(metricValue.Name, meterObj)
	}
	return meterObjs, nil
}

// initializeGeneralMetrics initializes the general metrics
func (m *MetricManager) initializeGeneralMetrics() error {
	meterObjs, err := m.initializeObservableMetrics(m.config.GeneralMetrics.MetricValue)
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

// initializeSystemRegularMetric initializes a non-observable system metric
func (m *MetricManager) initializeSystemRegularMetric(metricValue MetricValue) error {
	var err error
	switch metricValue.Name { //nolint:exhaustive
	case FlowsInvocationsMetric:
		m.flowsInvocationsCounter, err = m.meter.Int64Counter(
			string(FlowsInvocationsMetric),
			metric.WithDescription(metricValue.Description),
		)
	case RequestsThroughFlowsMetric:
		m.requestsThroughFlowsCounter, err = m.meter.Int64Counter(
			string(RequestsThroughFlowsMetric),
			metric.WithDescription(metricValue.Description),
		)
	default:
		log.Warn().Msgf("System metric %s is not supported", metricValue.Name)
	}

	return err
}

// initializeSystemMetrics initializes the system metrics
func (m *MetricManager) initializeSystemMetrics() error {
	var observableMetrics []MetricValue
	for _, metricValue := range m.config.SystemMetrics {
		if _, ok := metricsObservableRegistry[metricValue.Name]; ok {
			observableMetrics = append(observableMetrics, metricValue)
		} else if err := m.initializeSystemRegularMetric(metricValue); err != nil {
			return fmt.Errorf("failed to initialize regular system metric %s: %w", metricValue.Name, err)
		}
	}

	meterObjs, err := m.initializeObservableMetrics(observableMetrics)
	if err != nil {
		return fmt.Errorf("failed to initialize observable system metrics: %w", err)
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

// observeFlowInvocations observes the flow invocations metric
func (m *MetricManager) observeFlowInvocations(metricData *MetricData) {
	flowInvData := metricData.FlowInvocations
	attributes := buildAttributesFromLabelSet(flowInvData.FlowID, flowInvData.Labels)
	attributes = appendGatewayIDAttribute(attributes...)
	m.flowsInvocationsCounter.Add(context.Background(), 1, metric.WithAttributes(attributes...))
}

func (m *MetricManager) observeRequestsThroughFlows(metricData *MetricData) {
	attributes := buildAttributesFromLabelSet("", metricData.RequestsThroughFlows.Labels)
	attributes = appendGatewayIDAttribute(attributes...)
	m.requestsThroughFlowsCounter.Add(context.Background(), 1, metric.WithAttributes(attributes...))
}

func (m *MetricManager) observeGeneralMetrics(_ context.Context, observer metric.Observer) error {
	err := observeMetric(m, APICallSizeMetric, m.providerData.GetAvgAPICallSize(), observer)
	if err != nil {
		return err
	}

	return nil
}

func (m *MetricManager) observeSystemMetrics(_ context.Context, observer metric.Observer) error {
	data := m.providerData.GetFlowData()

	activeFlowsData := data.GetActiveFlows()
	for _, flowName := range activeFlowsData.ActiveFlows {
		attr := attribute.String(FlowName, flowName)
		attributes := appendGatewayIDAttribute(attr)
		if err := observeMetric(m, ActiveFlowsMetric, 1,
			observer, attributes...); err != nil {
			log.Trace().Err(err).Msgf("Failed to observe %v, flow %s", ActiveFlowsMetric, flowName)
		}
	}

	avgFlowExecutionData := data.GetAvgFlowExecutionTime()
	for flowName, execTime := range avgFlowExecutionData.AvgFlowExecutionTime {
		attr := attribute.String(FlowName, flowName)
		attributes := appendGatewayIDAttribute(attr)

		if err := observeMetric(m, AvgFlowExecutionTimeMetric,
			execTime, observer, attributes...); err != nil {
			log.Trace().Err(err).Msgf("Failed to observe %v, flow %s", AvgFlowExecutionTimeMetric, flowName)
		}
	}

	procExecutionData := data.GetProcessorExecutionData()
	for processorKey, procData := range procExecutionData.ProcExecutionData {
		attr := attribute.String(ProcessorKey, processorKey)
		attributes := appendGatewayIDAttribute(attr)

		if err := observeMetric(m, AvgProcessorExecutionTimeMetric, procData.AvgExecutionTime,
			observer, attributes...); err != nil {
			log.Trace().
				Err(err).
				Msgf("Failed to observe %v, processor %s", AvgProcessorExecutionTimeMetric, processorKey)
		}

		if err := observeMetric(m, ProcessorInvocation, 1, observer, attributes...); err != nil {
			log.Trace().
				Err(err).
				Msgf("Failed to observe %v, processor %s", ProcessorInvocation, processorKey)
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
	meterObjRaw, found := mng.metricObjects.Load(metricName)
	if !found {
		return fmt.Errorf("metric %s not found", metricName)
	}

	attributes = appendGatewayIDAttribute(attributes...)

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

func buildAttributesFromLabelSet(flowName string, labelSet *LabelSet) []attribute.KeyValue {
	var attributes []attribute.KeyValue
	if flowName != "" {
		attributes = addAttribute(FlowName, flowName, attribute.String, attributes)
	}

	if labelSet != nil {
		attributes = addAttribute(Host, labelSet.Host, attribute.String, attributes)
		attributes = addAttribute(HTTPMethod, labelSet.Method, attribute.String, attributes)
		attributes = addAttribute(ConsumerTag, labelSet.Consumer, attribute.String, attributes)
	}

	return attributes
}

func addAttribute[T int | string](
	key string,
	value T,
	addFunc func(key string, value T) attribute.KeyValue,
	attributes []attribute.KeyValue,
) []attribute.KeyValue {
	var isZero T
	if value != isZero {
		attributes = append(attributes, addFunc(key, value))
	}
	return attributes
}
