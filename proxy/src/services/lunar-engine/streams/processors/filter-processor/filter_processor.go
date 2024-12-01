package filterprocessor

import (
	"context"
	"fmt"
	"lunar/engine/actions"
	lunar_metrics "lunar/engine/metrics"
	"lunar/engine/streams/processors/utils"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	"lunar/toolkit-core/otel"
	"regexp"
	"strings"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/metric"
)

const (
	HitConditionName  = "hit"
	MissConditionName = "miss"

	URLParam      = "url"
	EndpointParam = "endpoint"
	MethodParam   = "method"
	BodyParam     = "body"
	HeaderParam   = "header"

	hitCountMetric  = "lunar_filter_processor_hit_count"
	missCountMetric = "lunar_filter_processor_miss_count"
)

type filterProcessor struct {
	name          string
	url           string
	endpoint      string
	method        string
	body          string
	headerKey     string
	headerValue   string
	metaData      *streamtypes.ProcessorMetaData
	labelManager  *lunar_metrics.LabelManager
	metricObjects map[string]metric.Float64Counter
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	proc := &filterProcessor{
		name:          metaData.Name,
		metaData:      metaData,
		metricObjects: make(map[string]metric.Float64Counter),
		labelManager:  lunar_metrics.NewLabelManager(metaData.GetMetricLabels()),
	}

	if err := proc.init(); err != nil {
		return nil, err
	}

	if err := proc.initializeMetrics(); err != nil {
		log.Error().Err(err).Msgf("failed to initialize metrics for %s", metaData.Name)
		proc.metaData.Metrics.Enabled = false
	}

	return proc, nil
}

func (p *filterProcessor) GetName() string {
	return p.name
}

func (p *filterProcessor) Execute(
	flowName string,
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	checkCondition := func(conditions map[string]string, filterField string, apiField func() string) {
		if filterField == "" {
			return
		}
		input := apiField()
		if filterField == input {
			conditions[HitConditionName] = filterField
		} else {
			conditions[MissConditionName] = filterField
			log.Trace().Msgf("condition failed: filter %v not equal to %v", filterField, input)
		}
	}

	conditions := make(map[string]string)

	// can be improved by using a map of functions
	checkCondition(conditions, p.method, apiStream.GetMethod)
	checkCondition(conditions, p.body, apiStream.GetBody)
	checkURLCondition(conditions, p.url, apiStream.GetURL())

	if p.headerKey != "" && p.headerValue != "" {
		if apiStream.DoesHeaderValueMatch(p.headerKey, p.headerValue) {
			log.Trace().Msgf("header %v matches %v", p.headerKey, p.headerValue)
			conditions[HitConditionName] = p.headerKey
		} else {
			log.Trace().Msgf("header %v does not match %v", p.headerKey, p.headerValue)
			log.Trace().Msgf("Got: %s=%s", p.headerKey, p.headerValue)
			conditions[MissConditionName] = p.headerKey
		}
	}

	condition := HitConditionName
	if _, ok := conditions[MissConditionName]; ok {
		condition = MissConditionName
	}

	p.updateMetrics(condition, flowName, apiStream)

	return streamtypes.ProcessorIO{
		Type:      apiStream.GetType(),
		ReqAction: &actions.NoOpAction{},
		Name:      condition,
	}, nil
}

func (p *filterProcessor) init() error {
	if err := utils.ExtractStrParam(p.metaData.Parameters,
		URLParam,
		&p.url); err != nil {
		log.Trace().Msgf("url not defined for %v", p.name)
	}

	if err := utils.ExtractStrParam(p.metaData.Parameters,
		EndpointParam,
		&p.endpoint); err != nil {
		log.Trace().Msgf("endpoint not defined for %v", p.name)
	}

	if err := utils.ExtractStrParam(p.metaData.Parameters,
		MethodParam,
		&p.method); err != nil {
		log.Trace().Msgf("method not defined for %v", p.name)
	}

	if err := utils.ExtractStrParam(p.metaData.Parameters,
		BodyParam,
		&p.body); err != nil {
		log.Trace().Msgf("body not defined for %v", p.name)
	}

	var keyValParam string
	if err := utils.ExtractStrParam(p.metaData.Parameters,
		HeaderParam,
		&keyValParam); err != nil {
		log.Trace().Msgf("header not defined for %v", p.name)
	} else {
		p.headerKey, p.headerValue = utils.ExtractKeyValuePair(keyValParam)
	}

	if p.url == "" && p.endpoint == "" && p.method == "" && p.body == "" &&
		p.headerKey == "" {
		return fmt.Errorf("no filter criteria defined for %v", p.name)
	}
	return nil
}

func (p *filterProcessor) initializeMetrics() error {
	log.Info().Msgf("Initializing metrics for %s", p.name)
	if !p.metaData.IsMetricsEnabled() {
		log.Info().Msgf("Metrics are disabled for %s", p.name)
		return nil
	}

	meter := otel.GetMeter()
	meterObj, err := meter.Float64Counter(hitCountMetric,
		metric.WithDescription(fmt.Sprintf("Filter hit count for %s", p.name)))
	if err != nil {
		return fmt.Errorf("failed to initialize hit count metric: %w", err)
	}
	p.metricObjects[hitCountMetric] = meterObj

	meterObj, err = meter.Float64Counter(missCountMetric,
		metric.WithDescription(fmt.Sprintf("Filter miss count for %s", p.name)))
	if err != nil {
		return fmt.Errorf("failed to initialize miss count metric: %w", err)
	}
	p.metricObjects[missCountMetric] = meterObj

	log.Info().Msgf("Metrics initialized for %s", p.name)
	return nil
}

func (p *filterProcessor) updateMetrics(
	condition, flowName string,
	provider lunar_metrics.APICallMetricsProviderI,
) {
	if !p.metaData.IsMetricsEnabled() {
		return
	}

	attributes := p.labelManager.GetProcessorMetricsAttributes(provider, flowName, p.name)

	updateMetricFunc := func(metricName string) {
		if metricObj, ok := p.metricObjects[metricName]; ok {
			metricObj.Add(context.Background(), 1, metric.WithAttributes(attributes...))
		}
	}
	metricName := hitCountMetric
	if condition == MissConditionName {
		metricName = missCountMetric
	}
	updateMetricFunc(metricName)

	log.Trace().Msgf("Metrics updated for %s", p.name)
}

// isFieldMatched checks if the inputField matches the filterField.
func isFieldMatched(filterField, inputField string) bool {
	if filterField == inputField {
		return true
	}

	regexPattern := filterField
	if strings.Contains(filterField, "*") && !utils.ContainsRegexPattern(filterField) {
		// Convert wildcard to regex
		regexPattern = strings.ReplaceAll(
			regexp.QuoteMeta(filterField),
			"\\*",
			".*",
		)
	}

	matched, _ := regexp.MatchString(regexPattern, inputField)
	return matched
}

func checkURLCondition(
	conditions map[string]string,
	filterURLField, inputURL string,
) {
	if filterURLField == "" {
		return
	}
	// ensure case insensitivity for filter
	filterURLField = strings.ToLower(filterURLField)

	parsedInputURL, err := utils.ExtractDomainAndPath(inputURL)
	if err != nil {
		log.Trace().Msgf("failed to extract domain and path from %v", inputURL)
		conditions[MissConditionName] = filterURLField
		return
	}

	if isFieldMatched(filterURLField, inputURL) {
		log.Trace().Msgf("URL filter %v accepts %v", filterURLField, inputURL)
		conditions[HitConditionName] = filterURLField
		return
	}

	if !utils.ContainsRegexPattern(filterURLField) {
		parsedFilterURL, err := utils.ExtractDomainAndPath(filterURLField)
		if err != nil {
			log.Trace().Msgf("failed to extract domain and path from %v", filterURLField)
			conditions[MissConditionName] = filterURLField
			return
		}

		if isFieldMatched(parsedFilterURL.Host, parsedInputURL.Host) {
			if parsedFilterURL.Path != "" && !isFieldMatched(parsedFilterURL.Path, parsedInputURL.Path) {
				log.Trace().Msgf("URL filter %v does not accept %v", filterURLField, inputURL)
				conditions[MissConditionName] = filterURLField
				return
			}

			log.Trace().Msgf("URL filter %v accepts %v", filterURLField, inputURL)
			conditions[HitConditionName] = filterURLField
			return
		}
	}

	log.Trace().Msgf("URL filter %v does not accept %v", filterURLField, inputURL)
	conditions[MissConditionName] = filterURLField
}
