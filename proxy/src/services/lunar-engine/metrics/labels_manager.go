package metrics

import (
	generalUtils "lunar/engine/utils"
	"lunar/engine/utils/environment"
	"sync"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
)

type LabelManager struct {
	labelsMap             map[string]string
	requestConsumerTagMap sync.Map
}

func NewLabelManager(labels []string) *LabelManager {
	labelsMap := make(map[string]string)
	for _, label := range labels {
		labelsMap[label] = label
	}
	return &LabelManager{
		labelsMap:             labelsMap,
		requestConsumerTagMap: sync.Map{},
	}
}

func (l *LabelManager) GatewayIDAttribute() []attribute.KeyValue {
	return appendGatewayIDAttribute(nil)
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

func (l *LabelManager) UpdateRequestConsumerTag(provider APICallMetricsProviderI) {
	if !provider.GetType().IsRequestType() {
		return
	}

	if consumerTagValue := l.getLabelValue(provider, ConsumerTag); consumerTagValue != "" {
		l.requestConsumerTagMap.Store(provider.GetID(), consumerTagValue)
	}
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
	case StatusCode:
		return provider.GetStrStatus()
	case ConsumerTag:
		if provider.GetType().IsRequestType() {
			headers := generalUtils.MakeHeadersLowercase(provider.GetHeaders())
			return headers[HeaderConsumerTag]
		} else if rawVal, found := l.requestConsumerTagMap.LoadAndDelete(provider.GetID()); found {
			return rawVal.(string)
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
