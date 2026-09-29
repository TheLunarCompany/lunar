package userdefinedmetrics

import (
	"context"
	"errors"
	"fmt"
	lunar_metrics "lunar/engine/metrics"
	"lunar/engine/streams/processors/utils"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/streams/stream"
	streamtypes "lunar/engine/streams/types"
	"lunar/toolkit-core/jsonpath"
	"lunar/toolkit-core/otel"
	"strconv"
	"strings"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const (
	counterType       = "counter"
	gaugeType         = "gauge"
	upDownCounterType = "up_down_counter"
	histogramType     = "histogram"
	metricPrefix      = "lunar_"

	apiCallCount = "api_call_count"
	apiCallSize  = "api_call_size"
)

type callbackValue struct {
	value      float64
	labels     map[string]string
	attributes []attribute.KeyValue
}

type userDefinedMetricsProcessor struct {
	name         string
	metricName   string
	metricType   string
	metricValue  string
	customLabels map[string]string
	labels       []string
	buckets      []float64

	metaData *streamtypes.ProcessorMetaData

	metricObj      interface{}
	callbackValues []callbackValue

	labelManager *lunar_metrics.LabelManager
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	processor := userDefinedMetricsProcessor{
		name:         metaData.Name,
		metaData:     metaData,
		customLabels: make(map[string]string),
	}
	var err error
	err = processor.setupParameters(metaData)
	if err != nil {
		return nil, err
	}

	processor.labelManager = lunar_metrics.NewLabelManager(processor.labels)

	meter := otel.GetMeter()

	fullMetricName := metricPrefix + processor.metricName
	err = processor.initializeMetric(meter, fullMetricName)
	if err != nil {
		return nil, err
	}
	return &processor, nil
}

func (p *userDefinedMetricsProcessor) Execute(
	flowName string,
	stream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	attributes, labelMap := p.labelManager.GetProcessorMetricsFullAttributes(
		stream,
		flowName,
		p.name,
	)
	for customLabelKey, customLabelPath := range p.customLabels {
		customLabelValue := getCustomLabelValue(stream, customLabelPath)
		if customLabelValue != "" {
			attributes = append(attributes, attribute.String(customLabelKey, customLabelValue))
			labelMap[customLabelKey] = customLabelValue
		}
	}

	metricValue, err := getMetricValue(stream, p.metricValue)
	if err != nil {
		log.Error().
			Err(err).
			Msgf("Error getting metric value: %s", p.metricValue)
		return streamtypes.ProcessorIO{}, err
	}

	switch p.metricType {
	case counterType:
		metricObj := p.metricObj.(metric.Float64Counter)
		log.Debug().Msgf("Adding metric value counter: %v", metricValue)
		metricObj.Add(
			context.Background(),
			metricValue,
			metric.WithAttributes(attributes...),
		)
	case upDownCounterType:
		metricObj := p.metricObj.(metric.Float64UpDownCounter)
		log.Debug().Msgf("Adding metric value up_down_counter: %v", metricValue)
		metricObj.Add(
			context.Background(),
			metricValue,
			metric.WithAttributes(attributes...),
		)
	case gaugeType:
		log.Debug().Msgf("Setting metric value gauge: %v", metricValue)
		p.addOrUpdateGaugeValue(metricValue, labelMap, attributes)
	case histogramType:
		metricObj := p.metricObj.(metric.Float64Histogram)
		log.Debug().Msgf("Adding metric value histogram: %v", metricValue)
		metricObj.Record(
			context.Background(),
			metricValue,
			metric.WithAttributes(attributes...),
		)
	default:
		log.Error().Msgf("Unknown metric type: %s", p.metricType)
		err := errors.New("unknown metric type")
		return streamtypes.ProcessorIO{}, err
	}
	return streamtypes.ProcessorIO{
		Type: publictypes.StreamTypeAny,
		Name: "",
	}, nil
}

func (p *userDefinedMetricsProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{
		IsBodyRequired: true,
	}
}

func (p *userDefinedMetricsProcessor) addOrUpdateGaugeValue(
	metricValue float64,
	labels map[string]string,
	attributes []attribute.KeyValue,
) {
	// If the labels are the same, we update the value
	// Otherwise, we add a new value
	for i, value := range p.callbackValues {
		if compareLabels(value.labels, labels) {
			p.callbackValues[i].value = metricValue
			return
		}
	}
	p.callbackValues = append(p.callbackValues, callbackValue{
		value:      metricValue,
		labels:     labels,
		attributes: attributes,
	})
}

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

func (p *userDefinedMetricsProcessor) setupParameters(
	metaData *streamtypes.ProcessorMetaData,
) error {
	var err error
	err = utils.ExtractStrParam(
		metaData.Parameters,
		"metric_name",
		&p.metricName,
	)
	if err != nil {
		log.Error().Err(err).Msg("Missing metric_name parameter")
		return err
	}

	err = utils.ExtractStrParam(
		metaData.Parameters,
		"metric_type",
		&p.metricType,
	)
	if err != nil || p.metricType == "" {
		p.metricType = counterType
	}

	err = utils.ExtractStrParam(
		metaData.Parameters,
		"metric_value",
		&p.metricValue,
	)
	if err != nil {
		p.metricValue = ""
	}

	err = utils.ExtractListOfStringParam(
		metaData.Parameters,
		"labels",
		&p.labels,
	)
	if err != nil {
		p.labels = []string{}
	}

	err = utils.ExtractMapOfStringParam(
		metaData.Parameters,
		"custom_metric_labels",
		p.customLabels,
	)
	if err != nil || len(p.customLabels) == 0 {
		log.Trace().Msg("No custom labels found")
		p.customLabels = nil
	}

	err = utils.ExtractListOfFloat64Param(
		metaData.Parameters,
		"buckets",
		&p.buckets,
	)
	if err != nil {
		p.buckets = []float64{}
	}
	return nil
}

func (p *userDefinedMetricsProcessor) initializeMetric(
	meter metric.Meter,
	metricName string,
) error {
	var err error
	switch p.metricType {
	case counterType:
		p.metricObj, err = meter.Float64Counter(
			metricName,
			metric.WithDescription("User defined metric"),
		)
		if err != nil {
			log.Error().Err(err).Msgf("Error creating counter: %v", err)
			return err
		}

	case gaugeType:
		p.metricObj, err = meter.Float64ObservableGauge(
			metricName,
			metric.WithDescription("User defined metric"),
			metric.WithFloat64Callback(p.metricCallback),
		)
		if err != nil {
			log.Error().Err(err).Msgf("Error creating gauge: %v", err)
			return err
		}

	case upDownCounterType:
		p.metricObj, err = meter.Float64UpDownCounter(
			metricName,
			metric.WithDescription("User defined metric"),
		)
		if err != nil {
			log.Error().Err(err).Msgf("Error creating up_down_counter: %v", err)
			return err
		}
	case histogramType:
		p.metricObj, err = meter.Float64Histogram(
			metricName,
			metric.WithDescription("User defined metric"),
			metric.WithExplicitBucketBoundaries(p.buckets...),
		)
		if err != nil {
			log.Error().Err(err).Msgf("Error creating histogram: %v", err)
			return err
		}
	default:
		log.Error().Msgf("Unknown metric type: %s", p.metricType)
		err := errors.New("unknown metric type")
		return err
	}
	return nil
}

func (p *userDefinedMetricsProcessor) metricCallback(
	_ context.Context,
	result metric.Float64Observer,
) error {
	for _, value := range p.callbackValues {
		result.Observe(
			value.value,
			metric.WithAttributes(value.attributes...),
		)
	}
	return nil
}

func getMetricValue(
	apiStream publictypes.APIStreamI,
	metricValueParam string,
) (float64, error) {
	if metricValueParam == "" {
		return 1, nil
	}

	// Handle special cases
	switch strings.ToLower(metricValueParam) {
	case apiCallCount:
		return 1, nil
	case apiCallSize:
		if apiStream.GetType().IsRequestType() {
			return float64(apiStream.GetRequest().GetSize()), nil
		}
		return float64(apiStream.GetResponse().GetSize()), nil
	}

	// If the metric value is not a special case, it is assumed to be a JSON path
	object := stream.AsObject(apiStream)
	value, err := jsonpath.GetJSONPathValue(object, metricValueParam)
	if err != nil {
		log.Trace().
			Err(err).
			Msgf("Error extracting value from JSON path: %s", metricValueParam)
		return 0, err
	}
	return convertToFloat64(value)
}

func convertToFloat64(value interface{}) (float64, error) {
	switch val := value.(type) {
	case float64:
		return val, nil
	case int:
		return float64(val), nil
	case string:
		value, err := strconv.ParseFloat(val, 64)
		if err != nil {
			log.Error().
				Err(err).
				Msgf("Error converting value to float64: %s", val)
			return 0, err
		}
		return value, nil
	}
	log.Error().Msgf("Unsupported type: %T", value)
	return 0, fmt.Errorf(
		"error converting value %v to float unsupported type: %T",
		value,
		value,
	)
}

func getCustomLabelValue(apiStream publictypes.APIStreamI, labelPath string) string {
	object := stream.AsObject(apiStream)

	// Since value can be an array or a string, we need to handle both cases
	value, err := jsonpath.GetJSONPathValue(object, labelPath)
	if err != nil {
		log.Trace().
			Err(err).
			Msgf("Error extracting value from JSON path: %s", labelPath)
		return ""
	}

	valueStr, ok := value.(string)
	if ok {
		return valueStr
	}
	valueStrArr, ok := value.([]string)
	if ok {
		if len(valueStrArr) == 0 {
			log.Trace().Msgf("No values found for JSON path, despite array: %s", labelPath)
			return ""
		}
		if len(valueStrArr) > 1 {
			log.Trace().
				Msgf("Multiple values found for JSON path: %s, will return first", labelPath)
		}
		return valueStrArr[0]
	}
	log.Trace().
		Msgf("Unsupported type for JSON path: %s, got %T", labelPath, value)
	return ""
}

func (p *userDefinedMetricsProcessor) GetName() string {
	return p.name
}
