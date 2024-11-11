package metrics

import (
	"context"
	"errors"
	"fmt"
	"lunar/toolkit-core/configuration"
	"lunar/toolkit-core/otel"
	"os"
	"sync"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const (
	metricsConfigFilePathEnvVar        = "LUNAR_PROXY_METRICS_CONFIG"
	metricsConfigFileDefaultPathEnvVar = "LUNAR_PROXY_METRICS_CONFIG_DEFAULT"
)

type callbackMetricValue struct {
	value      float64
	labels     map[string]string
	attributes []attribute.KeyValue
}

type MetricManager struct {
	config                   *Config
	meter                    metric.Meter
	metricObjects            map[Metric]interface{}
	labelManager             *LabelManager
	apiCallCountMetricMng    *apiCallCountMetricManager
	callbackValuesPerGauge   sync.Map // map[Metric][]callbackMetricValue
	previousValuesPerCounter sync.Map // map[Metric]float64
	metricManagerActive      bool
}

func NewMetricManager() (*MetricManager, error) {
	log.Info().Msg("Initializing metrics manager")
	meter := otel.GetMeter()
	mng, err := newMetricManager(meter)
	if err != nil {
		return &MetricManager{}, err
	}
	mng.metricManagerActive = true
	return mng, nil
}

// UpdateMetricsForAPICall updates the general metrics - relevant for the API calls
func (m *MetricManager) UpdateMetricsForAPICall(provider APICallMetricsProviderI) error {
	if !m.metricManagerActive {
		log.Error().Msg("metric manager is not active")
		return nil
	}

	if provider.GetType().IsRequestType() {
		return m.updateMetricsForAPIRequestCall(provider)
	}
	return m.updateMetricsForAPIResponseCall(provider)
}

// UpdateMetricsForFlow updates the system metrics - relevant for the flows
func (m *MetricManager) UpdateMetricsForFlow(provider FlowMetricsProviderI) error {
	if !m.metricManagerActive {
		log.Error().Msg("metric manager is not active")
		return nil
	}

	for _, systemMetric := range m.config.SystemMetrics {
		if _, ok := flowsMetrics[systemMetric.Name]; !ok {
			continue
		}
		value, err := getFlowMetricValue(provider, systemMetric.Name)
		if err != nil {
			log.Error().Err(err).Msgf("Error getting flow metric value: %s", systemMetric.Name)
			continue
		}

		if !m.shouldMetricBeUpdated(systemMetric, &value) {
			continue
		}

		err = m.updateMetric(systemMetric, value, nil, m.labelManager.GatewayIDAttribute())
		if err != nil {
			log.Error().Err(err).Msgf("Error updating metric: %s", systemMetric.Name)
			continue
		}
	}
	return nil
}

// GetMetricsConfig returns the metrics config
func (m *MetricManager) GetMetricsConfig() *Config {
	return m.config
}

func (m *MetricManager) updateMetricsForAPIRequestCall(provider APICallMetricsProviderI) error {
	m.labelManager.UpdateRequestConsumerTag(provider)
	return nil
}

func (m *MetricManager) updateMetricsForAPIResponseCall(provider APICallMetricsProviderI) error {
	attributes, labelValueMap := m.labelManager.GetAPICallAttributes(provider)
	attributes = appendGatewayIDAttribute(attributes)

	for _, metricValue := range m.config.GeneralMetrics.MetricValue {
		if _, ok := m.metricObjects[metricValue.Name]; !ok {
			continue
		}

		value, err := getAPICallMetricValue(provider, metricValue.Name)
		if err != nil {
			log.Error().Err(err).Msgf("Error getting metric value: %s", metricValue.Name)
			continue
		}

		err = m.updateMetric(metricValue, value, labelValueMap, attributes)
		if err != nil {
			log.Error().Err(err).Msgf("Error updating metric: %s", metricValue.Name)
			continue
		}

		log.Debug().Msgf("Updated metric %s with value %f", metricValue.Name, value)
	}
	return nil
}

func (m *MetricManager) updateMetric(
	metricValue MetricValue,
	value float64,
	labelValueMap map[string]string,
	attributes []attribute.KeyValue,
) error {
	ctx := context.Background()
	switch metricValue.Type {
	case Counter:
		metricObj := m.metricObjects[metricValue.Name].(metric.Float64Counter)
		metricObj.Add(ctx, value, metric.WithAttributes(attributes...))
	case UpDownCounter:
		metricObj := m.metricObjects[metricValue.Name].(metric.Float64UpDownCounter)
		metricObj.Add(ctx, value, metric.WithAttributes(attributes...))
	case Gauge:
		m.addOrUpdateGaugeValue(metricValue.Name, value, labelValueMap, attributes)
	case Histogram:
		metricObj := m.metricObjects[metricValue.Name].(metric.Float64Histogram)
		metricObj.Record(ctx, value, metric.WithAttributes(attributes...))
	case Custom:
		// TODO: Implement custom metric based on json path in the future
	default:
		return fmt.Errorf("unknown metric type: %s", metricValue.Type)
	}
	log.Debug().Msgf("Updated metric %s with value %f", metricValue.Name, value)
	return nil
}

func newMetricManager(meter metric.Meter) (*MetricManager, error) {
	config, err := loadMetricsConfig()
	if err != nil {
		log.Error().Err(err).Msg("failed to get metrics config")
		return nil, err
	}
	metricMng := &MetricManager{
		config:                 config,
		meter:                  meter,
		metricObjects:          make(map[Metric]interface{}),
		labelManager:           NewLabelManager(config.GeneralMetrics.LabelValue),
		callbackValuesPerGauge: sync.Map{},
	}

	err = metricMng.initializeMetrics()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize metrics: %w", err)
	}

	log.Info().Msg("Metrics manager initialized")

	return metricMng, nil
}

// getAPICallMetricValue returns the value of the given metric
func getAPICallMetricValue(provider APICallMetricsProviderI, metric Metric) (float64, error) {
	switch metric { //nolint:exhaustive
	case APICallCountMetric:
		return 1, nil
	case APICallSizeMetric:
		return float64(provider.GetSize()), nil
	default:
		return 0, fmt.Errorf("unknown metric: %s", metric)
	}
}

// getFlowMetricValue returns the value of the given metric
func getFlowMetricValue(provider FlowMetricsProviderI, metric Metric) (float64, error) {
	switch metric { //nolint:exhaustive
	case ActiveFlowsMetric:
		return float64(provider.GetActiveFlows()), nil
	case FlowsInvocationsMetric:
		return float64(provider.GetFlowInvocations()), nil
	case RequestsThroughFlowsMetric:
		return float64(provider.GetRequestsThroughFlows()), nil
	case AvgFlowExecutionTimeMetric:
		return provider.GetAvgFlowExecutionTime(), nil
	case AvgProcessorExecutionTimeMetric:
		return provider.GetAvgProcessorExecutionTime(), nil
	default:
		return 0, fmt.Errorf("unknown metric: %s", metric)
	}
}

// shouldMetricBeUpdated checks if the metric should be updated.
// It implements 'set value' logic for counter metrics instead of 'add value'.
// If it's should be - value will be updated.
func (m *MetricManager) shouldMetricBeUpdated(metricVal MetricValue, value *float64) bool {
	if metricVal.Type != Counter && metricVal.Type != UpDownCounter {
		return true
	}

	previousValueRaw, found := m.previousValuesPerCounter.Load(metricVal.Name)
	if !found {
		m.previousValuesPerCounter.Store(metricVal.Name, *value)
		return true
	}

	previousValue := previousValueRaw.(float64)
	if *value != previousValue {
		m.previousValuesPerCounter.Store(metricVal.Name, *value)
		*value = *value - previousValue
		return true
	}

	return false
}

// initializeMetrics initializes the metrics by parsing
func (m *MetricManager) initializeMetrics() (err error) {
	log.Info().Msg("Initializing metrics")
	// Initialize general metrics
	for _, metricValue := range m.config.GeneralMetrics.MetricValue {
		if metricValue.Name == APICallCountMetric {
			m.apiCallCountMetricMng, err = newAPICallCountMetricManager(m.meter, m.labelManager.labelsMap)
			if err != nil {
				return fmt.Errorf("failed to initialize APICallCountMetric: %w", err)
			}
			continue
		}

		err = m.initializeMeter(m.meter, metricValue.Name, metricValue.Type)
		if err != nil {
			return fmt.Errorf("failed to initialize general metric %s: %w", metricValue.Name, err)
		}
	}

	// Initialize system metrics
	for _, systemMetric := range m.config.SystemMetrics {
		err := m.initializeMeter(m.meter, systemMetric.Name, systemMetric.Type)
		if err != nil {
			return fmt.Errorf("failed to initialize system metric %s: %w", systemMetric.Name, err)
		}
	}
	return nil
}

// initializeMeter initializes a meter according to the given metric type
func (m *MetricManager) initializeMeter(
	meter metric.Meter,
	metricName Metric,
	metricType MetricType,
) (err error) {
	var meterObj interface{}

	switch metricType {
	case Counter:
		meterObj, err = meter.Float64Counter(
			string(metricName),
			metric.WithDescription("User defined counter metric"),
		)
	case UpDownCounter:
		meterObj, err = meter.Float64UpDownCounter(
			string(metricName),
			metric.WithDescription("User defined up-down counter metric"),
		)
	case Gauge:
		meterObj, err = meter.Float64ObservableGauge(
			string(metricName),
			metric.WithDescription("User defined gauge metric"),
			metric.WithFloat64Callback(m.specificGaugeMetricCallback(metricName)),
		)
	case Histogram:
		meterObj, err = meter.Float64Histogram(
			string(metricName),
			metric.WithDescription("User defined histogram metric"),
		)
	case Custom:
		// TODO: Implement custom metric based on json path in the future
		return nil
	default:
		return fmt.Errorf("unknown metric type: %s", metricType)
	}

	if err != nil {
		log.Error().Err(err).Msgf("Error creating metric %s: %v", metricName, err)
		return err
	}

	m.metricObjects[metricName] = meterObj
	return nil
}

func (m *MetricManager) specificGaugeMetricCallback(metricName Metric) metric.Float64Callback {
	return func(_ context.Context, result metric.Float64Observer) error {
		callbackValuesRaw, found := m.callbackValuesPerGauge.Load(metricName)
		if !found {
			return nil
		}
		callbackValues := callbackValuesRaw.([]callbackMetricValue)

		for _, value := range callbackValues {
			result.Observe(
				value.value,
				metric.WithAttributes(value.attributes...),
			)
		}
		log.Debug().Msgf("Updated gauge metric %s", metricName)
		return nil
	}
}

// addOrUpdateGaugeValue adds or updates a gauge value
func (m *MetricManager) addOrUpdateGaugeValue(
	metric Metric,
	metricValue float64,
	labelMap map[string]string,
	attributes []attribute.KeyValue,
) {
	callbackValuesRaw, found := m.callbackValuesPerGauge.Load(metric)
	if !found {
		m.callbackValuesPerGauge.Store(metric, []callbackMetricValue{
			{
				value:      metricValue,
				labels:     labelMap,
				attributes: attributes,
			},
		})
		return
	}

	callbackValues := callbackValuesRaw.([]callbackMetricValue)

	shouldAddNewValue := true
	for i, value := range callbackValues {
		// Labels are optional for gauge metrics, labelMap can be nil.
		// If labels not specified, we will just update metric value
		// If the labels are the same, we update the value, otherwise, we add a new value
		if labelMap == nil || compareLabels(value.labels, labelMap) {
			callbackValues[i].value = metricValue
			shouldAddNewValue = false
			break
		}
	}
	if shouldAddNewValue {
		callbackValues = append(callbackValues, callbackMetricValue{
			value:      metricValue,
			labels:     labelMap,
			attributes: attributes,
		})
	}
	m.callbackValuesPerGauge.Store(metric, callbackValues)
}

// compareLabels compares two label maps
func compareLabels(
	labels map[string]string,
	otherLabels map[string]string,
) bool {
	if len(labels) != len(otherLabels) {
		return false
	}
	for key, value := range labels {
		if otherValue, ok := otherLabels[key]; !ok || otherValue != value {
			return false
		}
	}
	return true
}

// getMetricsConfigFilePath returns the path to the metrics config file
func getMetricsConfigFilePath() (string, error) {
	filePath, err := configuration.GetPathFromEnvVarOrDefault(
		metricsConfigFilePathEnvVar,
		"./metrics.yaml",
	)
	log.Info().Msgf("Trying to find metrics config file at: %s", filePath)
	if err == nil {
		_, err := os.Stat(filePath)
		if err == nil {
			return filePath, nil
		}
	}
	return configuration.GetPathFromEnvVarOrDefault(
		metricsConfigFileDefaultPathEnvVar,
		"./metrics.yaml",
	)
}

// loadMetricsConfig loads and returns the metrics config
func loadMetricsConfig() (*Config, error) {
	log.Info().Msg("Loading metrics config")
	configFilePath, err := getMetricsConfigFilePath()
	if err != nil {
		return nil, err
	}
	log.Info().Msgf("Metrics config file path: %s", configFilePath)
	result, err := configuration.DecodeYAML[Config](configFilePath)
	if err != nil {
		return nil, err
	}
	if len(result.Content) == 0 {
		return nil, errors.New("metrics config file is empty")
	}
	return result.UnmarshaledData, nil
}
