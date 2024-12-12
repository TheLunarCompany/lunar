package metrics

import (
	generalUtils "lunar/engine/utils"
	"lunar/engine/utils/environment"
	"sync"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

type LabelManager struct {
	mu        sync.Mutex
	labelsMap map[string]string
}

func NewLabelManager(labels []string) *LabelManager {
	return &LabelManager{
		mu:        sync.Mutex{},
		labelsMap: generalUtils.SliceToMap(labels),
	}
}

func (l *LabelManager) SetLabels(labels []string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.labelsMap = generalUtils.SliceToMap(labels)
}

func (l *LabelManager) GetProcessorMetricsAttributes(
	provider APICallMetricsProviderI,
	flowName, processorKey string,
) []attribute.KeyValue {
	// add attributes from provider
	attributes, _ := l.GetAPICallAttributes(provider)

	// adds flow name and processor key to the attributes, if defined by the labels
	if _, ok := l.labelsMap[FlowName]; ok {
		attributes = append(attributes, attribute.String(FlowName, flowName))
	}
	if _, ok := l.labelsMap[ProcessorKey]; ok {
		attributes = append(attributes, attribute.String(ProcessorKey, processorKey))
	}

	// add gateway id
	attributes = appendGatewayIDAttribute(attributes)
	return attributes
}

func (l *LabelManager) GetAPICallAttributes(
	provider APICallMetricsProviderI,
) (attributes []attribute.KeyValue, labelValueMap map[string]string) {
	labelValueMap = make(map[string]string)

	var value string
	for _, label := range l.labelsMap {
		value = l.getLabelValue(provider, label)
		if value == "" {
			continue
		}

		labelValueMap[label] = value
		attributes = append(
			attributes,
			attribute.String(label, value),
		)

	}
	return
}

// getLabelValue returns the value of the given label
func (l *LabelManager) getLabelValue(provider APICallMetricsProviderI, label string) string {
	switch label {
	case FlowName:
		return "" // treated as a special case
	case ProcessorKey:
		return "" // treated as a special case
	case HTTPMethod:
		return provider.GetMethod()
	case URL:
		return provider.GetURL()
	case Host:
		return provider.GetHost()
	case StatusCode:
		return provider.GetStrStatus()
	case ConsumerTag:
		if provider.GetType().IsRequestType() {
			headers := generalUtils.MakeHeadersLowercase(provider.GetHeaders())
			return headers[HeaderConsumerTag]
		}
		return ""
	}
	log.Warn().Msgf("label %s not supported", label)
	return ""
}

// appendGatewayIDAttribute appends the gateway ID attribute to the given attributes
func appendGatewayIDAttribute(attributes []attribute.KeyValue) []attribute.KeyValue {
	gatewayID := environment.GetGatewayInstanceID()
	if gatewayID == "" {
		return attributes
	}
	return append(attributes, attribute.String("gateway_id", gatewayID))
}

func withGatewayIDAttribute() metric.MeasurementOption {
	attributes := appendGatewayIDAttribute(nil)
	return metric.WithAttributes(attributes...)
}
