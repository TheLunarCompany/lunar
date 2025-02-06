package metrics

import (
	"lunar/engine/utils"
	"lunar/engine/utils/environment"
	"strconv"
	"sync"

	shared_discovery "lunar/shared-model/discovery"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
)

type LabelManager struct {
	mu                 sync.Mutex
	labelsMap          map[string]string
	labeledEndpointMng *LabeledEndpointManager
}

func NewLabelManager(labels []string) *LabelManager {
	return &LabelManager{
		mu:        sync.Mutex{},
		labelsMap: utils.SliceToMap(labels),
	}
}

func (l *LabelManager) WithLabeledEndpointManager(
	labeledEndpointMng *LabeledEndpointManager,
) *LabelManager {
	l.labeledEndpointMng = labeledEndpointMng
	return l
}

func (l *LabelManager) SetLabels(labels []string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.labelsMap = utils.SliceToMap(labels)
}

func (l *LabelManager) GetAttributesFromDiscoveryEndpoint(
	endpoint shared_discovery.Endpoint,
	consumerTag string,
	statusCode int,
) []attribute.KeyValue {
	var attributes []attribute.KeyValue
	for label := range l.labelsMap {
		value := ""
		switch label {
		case HTTPMethod:
			value = endpoint.Method
		case URL:
			value = endpoint.URL
		case Host:
			value = utils.ExtractHost(endpoint.URL)
		case StatusCode:
			if statusCode != 0 {
				value = strconv.Itoa(statusCode)
			}
		case ConsumerTag:
			if consumerTag != "-" {
				value = consumerTag
			}
		}

		if value != "" {
			attributes = append(attributes, attribute.String(label, value))
		}
	}

	attributes = l.appendLabeledEndpointAttribute(endpoint.URL, attributes)
	attributes = appendGatewayIDAttribute(attributes)

	return attributes
}

func (l *LabelManager) GetProcessorMetricsAttributes(
	provider APICallMetricsProviderI,
	flowName, processorKey string,
) []attribute.KeyValue {
	attributes, _ := l.GetProcessorMetricsFullAttributes(provider, flowName, processorKey)
	return attributes
}

func (l *LabelManager) GetProcessorMetricsFullAttributes(
	provider APICallMetricsProviderI,
	flowName, processorKey string,
) ([]attribute.KeyValue, map[string]string) {
	// add attributes from provider
	attributes, labelValueMap := l.GetAPICallAttributes(provider)

	// adds flow name and processor key to the attributes, if defined by the labels
	if _, ok := l.labelsMap[FlowName]; ok {
		attributes = append(attributes, attribute.String(FlowName, flowName))
		labelValueMap[FlowName] = flowName
	}
	if _, ok := l.labelsMap[ProcessorKey]; ok {
		attributes = append(attributes, attribute.String(ProcessorKey, processorKey))
		labelValueMap[ProcessorKey] = processorKey
	}

	// add gateway id
	attributes = appendGatewayIDAttribute(attributes)
	gatewayID := environment.GetGatewayInstanceID()
	if gatewayID != "" {
		labelValueMap["gateway_id"] = gatewayID
	}

	return attributes, labelValueMap
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
			headers := provider.GetHeaders()
			return headers[HeaderConsumerTag]
		}
		return ""
	}
	log.Warn().Msgf("label %s not supported", label)
	return ""
}

// appendLabeledEndpointAttribute appends the labeled endpoint attribute to the given attributes
func (l *LabelManager) appendLabeledEndpointAttribute(
	url string,
	attributes []attribute.KeyValue,
) []attribute.KeyValue {
	if l.labeledEndpointMng == nil {
		return attributes
	}

	if label := l.labeledEndpointMng.ExtractLabel(url); label != nil {
		attributes = append(attributes, *label)
	}
	return attributes
}

// appendGatewayIDAttribute appends the gateway ID attribute to the given attributes
func appendGatewayIDAttribute(attributes []attribute.KeyValue) []attribute.KeyValue {
	gatewayID := environment.GetGatewayInstanceID()
	if gatewayID == "" {
		return attributes
	}
	return append(attributes, attribute.String("gateway_id", gatewayID))
}
