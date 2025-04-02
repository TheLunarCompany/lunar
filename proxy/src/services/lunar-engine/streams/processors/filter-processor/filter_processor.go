package filterprocessor

import (
	"context"
	"fmt"
	"lunar/engine/actions"
	lunar_metrics "lunar/engine/metrics"
	"lunar/engine/streams/processors/utils"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	lunar_utils "lunar/engine/utils"
	"lunar/toolkit-core/otel"
	"net/url"
	"regexp"
	"strconv"
	"strings"

	map_set "github.com/deckarep/golang-set/v2"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/metric"
)

const (
	HitConditionName  = "hit"
	MissConditionName = "miss"

	URLParam             = "url"
	EndpointParam        = "endpoint"
	MethodParam          = "method"
	BodyParam            = "body"
	HeaderParam          = "header"
	StatusCodeRangeParam = "status_code_range"

	hitCountMetric  = "lunar_filter_processor_hit_count"
	missCountMetric = "lunar_filter_processor_miss_count"
)

type filterProcessor struct {
	name           string
	urls           []string
	endpoints      []string
	methods        []string
	headers        map[string]string
	body           string
	statusCodeFrom int
	statusCodeTo   int

	metaData      *streamtypes.ProcessorMetaData
	labelManager  *lunar_metrics.LabelManager
	metricObjects map[string]metric.Float64Counter
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	proc := &filterProcessor{
		name:          metaData.Name,
		metaData:      metaData,
		headers:       make(map[string]string),
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

func (p *filterProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{
		IsBodyRequired: p.body != "",
	}
}

func (p *filterProcessor) Execute(
	flowName string,
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	conditions := map_set.NewSet[string]()

	getEndpoint := func() string {
		parsedURL, _ := url.Parse(apiStream.GetURL())
		if parsedURL != nil {
			return parsedURL.Path
		}
		return ""
	}

	checkStrArrayCondition(conditions, apiStream.GetMethod, p.methods)
	checkCondition(conditions, apiStream.GetBody, p.body)
	checkStrArrayCondition(conditions, getEndpoint, p.endpoints)
	checkURLCondition(conditions, apiStream.GetURL, p.urls)
	checkHeaderCondition(conditions, apiStream, p.headers)
	checkStatusCodeCondition(conditions, apiStream, p.statusCodeFrom, p.statusCodeTo)

	condition := HitConditionName
	if conditions.Contains(MissConditionName) {
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
	p.extractSingleOrMultipleParam(URLParam, &p.urls)
	p.extractSingleOrMultipleParam(EndpointParam, &p.endpoints)
	p.extractSingleOrMultipleParam(MethodParam, &p.methods)
	p.extractSingleOrMultipleHeadersParam()

	if err := utils.ExtractStrParam(p.metaData.Parameters,
		BodyParam,
		&p.body); err != nil {
		log.Trace().Msgf("body not defined for %v", p.name)
	}

	if err := p.extractStatusCodeRangeParam(); err != nil {
		return err
	}

	if len(p.urls) == 0 && len(p.endpoints) == 0 && len(p.methods) == 0 && p.body == "" &&
		len(p.headers) == 0 && !p.isValidStatusCode() {
		return fmt.Errorf("no filter criteria defined for %v", p.name)
	}
	return nil
}

func (p *filterProcessor) extractStatusCodeRangeParam() error {
	var statusCodeRange string
	if err := utils.ExtractStrParam(p.metaData.Parameters,
		StatusCodeRangeParam,
		&statusCodeRange); err != nil {
		log.Trace().Msgf("method not defined for %v", p.name)
	}

	if statusCodeRange != "" {
		statusCodeRangeValues := strings.Split(statusCodeRange, "-")
		if len(statusCodeRangeValues) != 2 {
			return fmt.Errorf("invalid status code range: %v", statusCodeRange)
		}

		var err error
		p.statusCodeFrom, err = strconv.Atoi(statusCodeRangeValues[0])
		if err != nil {
			return fmt.Errorf("invalid status code from value: %v", statusCodeRangeValues[0])
		}
		p.statusCodeTo, err = strconv.Atoi(statusCodeRangeValues[1])
		if err != nil {
			return fmt.Errorf("invalid status code to value: %v", statusCodeRangeValues[1])
		}
	}
	return nil
}

func (p *filterProcessor) extractSingleOrMultipleHeadersParam() {
	var headerKeyVal string
	_ = utils.ExtractStrParam(p.metaData.Parameters, HeaderParam, &headerKeyVal)

	if headerKeyVal != "" {
		headerKey, headerValue := utils.ExtractKeyValuePair(headerKeyVal)
		if headerKey != "" && headerValue != "" {
			p.headers[headerKey] = headerValue
		}
		return
	}

	_ = utils.ExtractMapOfStringParam(p.metaData.Parameters, HeaderParam+"s", p.headers)

	if len(p.headers) == 0 {
		log.Trace().Msgf("header(s) not defined for %v", p.name)
		return
	}
}

func (p *filterProcessor) extractSingleOrMultipleParam(param string, values *[]string) {
	var val string
	_ = utils.ExtractStrParam(p.metaData.Parameters, param, &val)

	if val != "" {
		*values = append(*values, val)
		return
	}

	_ = utils.ExtractListOfStringParam(p.metaData.Parameters, param+"s", values)

	if len(*values) == 0 {
		log.Trace().Msgf("%s(s) not defined for %v", param, p.name)
	}
}

func (p *filterProcessor) isValidStatusCode() bool {
	isStatusValid := p.statusCodeFrom <= p.statusCodeTo
	if !isStatusValid {
		log.Error().
			Int("statusCodeFrom", p.statusCodeFrom).
			Int("statusCodeTo", p.statusCodeTo).
			Msg("invalid status code range, value from should be less than or equal to value to")
		return false
	}
	isStatusInRange := 100 <= p.statusCodeFrom && p.statusCodeTo <= 599
	if !isStatusInRange {
		log.Error().
			Int("statusCodeFrom", p.statusCodeFrom).
			Int("statusCodeTo", p.statusCodeTo).
			Msg("invalid status code range, value from should be between 100 and 599")
		return false
	}

	return true
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
	if strings.EqualFold(filterField, inputField) {
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

func checkCondition(
	conditions map_set.Set[string],
	apiField func() string,
	filterFields string,
) {
	if filterFields == "" {
		return
	}
	checkStrArrayCondition(conditions, apiField, []string{filterFields})
}

func checkStrArrayCondition(
	conditions map_set.Set[string],
	apiField func() string,
	filterFields []string,
) {
	if len(filterFields) == 0 {
		return
	}

	input := apiField()
	if input == "" {
		return
	}
	for _, field := range filterFields {
		if strings.EqualFold(field, input) {
			log.Trace().Msgf("condition hit: input %v in: %v", input, filterFields)
			conditions.Add(HitConditionName)
			return
		}
	}
	conditions.Add(MissConditionName)
	log.Trace().Msgf("condition failed: input %v not in: %v", input, filterFields)
}

func checkURLCondition(
	conditions map_set.Set[string],
	apiField func() string,
	filterURLFields []string,
) {
	inputURL := apiField()
	if len(filterURLFields) == 0 || inputURL == "" {
		return
	}

	for _, filterURLField := range filterURLFields {
		// ensure case insensitivity for filter
		filterURLField = strings.ToLower(filterURLField)
		parsedInputURL, err := utils.ExtractDomainAndPath(inputURL)
		if err != nil {
			log.Trace().Msgf("failed to extract domain and path from %v", inputURL)
			conditions.Add(MissConditionName)
			return
		}

		// check if the filterURLField is matched or it's  matched by a wildcard
		if isFieldMatched(filterURLField, inputURL) {
			log.Trace().Msgf("URL filter %v accepts %v", filterURLField, inputURL)
			conditions.Add(HitConditionName)
			return
		}

		// check if the filterURLField is a regex pattern
		if !utils.ContainsRegexPattern(filterURLField) {
			parsedFilterURL, err := utils.ExtractDomainAndPath(filterURLField)
			if err != nil {
				log.Trace().Msgf("failed to extract domain and path from %v", filterURLField)
				conditions.Add(MissConditionName)
				return
			}

			// match by host
			if isFieldMatched(parsedFilterURL.Host, parsedInputURL.Host) {
				if parsedFilterURL.Path != "" && !isFieldMatched(parsedFilterURL.Path, parsedInputURL.Path) {
					log.Trace().Msgf("URL filter %v does not accept %v", filterURLField, inputURL)
					conditions.Add(MissConditionName)
					return
				}

				log.Trace().Msgf("URL filter %v accepts %v", filterURLField, inputURL)
				conditions.Add(HitConditionName)
				return
			}
		}
	}

	log.Trace().Msgf("condition failed. Input %v not in: %v", inputURL, filterURLFields)
	conditions.Add(MissConditionName)
}

func checkHeaderCondition(
	conditions map_set.Set[string],
	apiStream publictypes.APIStreamI,
	filterHeaders map[string]string,
) {
	if len(filterHeaders) == 0 {
		return
	}

	for headerKey, headerValue := range filterHeaders {
		if apiStream.DoesHeaderValueMatch(headerKey, headerValue) {
			log.Trace().Msgf("header %v matches %v", headerKey, headerValue)
			conditions.Add(HitConditionName)
			return
		}
	}
	log.Trace().Msgf("condition fail. Headers %v not match %v", filterHeaders, apiStream.GetHeaders())
	conditions.Add(MissConditionName)
}

func checkStatusCodeCondition(
	conditions map_set.Set[string],
	apiStream publictypes.APIStreamI,
	statusCodeFrom, statusCodeTo int,
) {
	if apiStream.GetType().IsRequestType() {
		return
	}

	if statusCodeFrom == 0 && statusCodeTo == 0 {
		return
	}

	response := apiStream.GetResponse()
	if lunar_utils.IsInterfaceNil(response) {
		return
	}

	status := response.GetStatus()
	if status >= statusCodeFrom && status <= statusCodeTo {
		log.Trace().Msgf("condition hit: Status %v in %v-%v", status, statusCodeFrom, statusCodeTo)
		conditions.Add(HitConditionName)
	} else {
		log.Trace().Msgf("condition failed: Status %v not in %v-%v", status, statusCodeFrom, statusCodeTo)
		conditions.Add(MissConditionName)
	}
}
