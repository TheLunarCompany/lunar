package metrics

import (
	generalUtils "lunar/engine/utils"
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

// AddCallerAttributes adds flow name and processor key to the attributes, if defined by the labels
func (l *LabelManager) AddCallerAttributes(
	flowNameVal, processKeyVal string,
	attributes []attribute.KeyValue,
) []attribute.KeyValue {
	if _, ok := l.labelsMap[FlowName]; ok {
		attributes = append(attributes, attribute.String(FlowName, flowNameVal))
	}
	if _, ok := l.labelsMap[ProcessorKey]; ok {
		attributes = append(attributes, attribute.String(ProcessorKey, processKeyVal))
	}
	return attributes
}

func (l *LabelManager) ExtractAttributesFromLabels(
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
