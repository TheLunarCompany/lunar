package userdefinedmetrics

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	lunar_metrics "lunar/engine/metrics"
	"lunar/engine/streams/processors/utils"
	publictypes "lunar/engine/streams/public-types"
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
)

type callbackValue struct {
	value      float64
	labels     map[string]string
	attributes []attribute.KeyValue
}

type userDefinedMetricsProcessor struct {
	name             string
	metricName       string
	metricType       string
	metricValue      string
	customLabel      string
	customLabelValue string
	labels           []string
	buckets          []float64

	metaData *streamtypes.ProcessorMetaData

	metricObj      interface{}
	callbackValues []callbackValue

	labelManager *lunar_metrics.LabelManager
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	processor := userDefinedMetricsProcessor{
		name:     metaData.Name,
		metaData: metaData,
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
	attributes, labelMap := p.labelManager.GetProcessorMetricsFullAttributes(stream, flowName, p.name)
	if p.customLabel != "" {
		customLabelValue := getCustomLabelValue(stream, p.customLabelValue)
		if customLabelValue != "" {
			attributes = append(attributes, attribute.String(p.customLabel, customLabelValue))
			labelMap[p.customLabel] = customLabelValue
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

	err = utils.ExtractStrParam(
		metaData.Parameters,
		"custom_metric_label",
		&p.customLabel,
	)
	if err != nil {
		p.customLabel = ""
	}

	err = utils.ExtractStrParam(
		metaData.Parameters,
		"custom_metric_label_value",
		&p.customLabelValue,
	)
	if err != nil {
		p.customLabelValue = ""
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
	stream publictypes.APIStreamI,
	metricValueParam string,
) (float64, error) {
	if metricValueParam == "" {
		return 1, nil
	}

	metricValueParam = strings.ToLower(metricValueParam)
	object := getObject(stream)

	value, err := jsonpath.GetJSONPathValue(object, metricValueParam)
	if err != nil {
		log.Error().
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

func getCustomLabelValue(stream publictypes.APIStreamI, label string) string {
	label = strings.ToLower(label)
	object := getObject(stream)

	value, err := jsonpath.GetJSONPathValueAsType[string](object, label)
	if err != nil {
		log.Error().
			Err(err).
			Msgf("Error extracting value from JSON path: %s", label)
		return ""
	}
	return value
}

func getObject(stream publictypes.APIStreamI) map[string]interface{} {
	var rawBody string
	var body interface{}
	var headers map[string]interface{}
	var err error
	if stream.GetType() == publictypes.StreamTypeRequest {
		rawBody = stream.GetRequest().GetBody()
		headers = toMap(stream.GetRequest().GetHeaders())
	} else {
		rawBody = stream.GetResponse().GetBody()
		headers = toMap(stream.GetResponse().GetHeaders())
	}

	body, err = stringToMap(rawBody)
	if err != nil {
		log.Debug().
			Err(err).
			Msgf("Error converting body to map, defaulting to string value: %v", rawBody)
		body = rawBody
	}

	object := map[string]interface{}{
		"body":    body,
		"headers": headers,
	}

	return object
}

func stringToMap(s string) (map[string]interface{}, error) {
	object := map[string]interface{}{}
	err := json.Unmarshal([]byte(s), &object)
	if err != nil {
		return map[string]interface{}{}, err
	}
	return object, nil
}

func toMap(object map[string]string) map[string]interface{} {
	newObject := make(map[string]interface{}, len(object))
	for k, v := range object {
		newObject[k] = interface{}(v)
	}
	return newObject
}

func (p *userDefinedMetricsProcessor) GetName() string {
	return p.name
}
