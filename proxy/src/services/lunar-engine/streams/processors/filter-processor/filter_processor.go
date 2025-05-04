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
	ExpressionsParam     = "expressions"

	hitCountMetric  = "lunar_filter_processor_hit_count"
	missCountMetric = "lunar_filter_processor_miss_count"
)

type filterProcessor struct {
	name           string
	urls           []string
	endpoints      []string
	methods        []string
	reqExpressions []string
	resExpressions []string
	headers        map[string]string
	body           string
	bodyRequired   bool
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
	log.Warn().Bool("bodyRequired", p.bodyRequired).Msgf("body required: %v", p.bodyRequired)
	return &streamtypes.ProcessorRequirement{
		IsBodyRequired: p.bodyRequired,
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

	log.Trace().Msgf("Checking conditions for %s", p.name)
	if len(p.reqExpressions) > 0 {
		// load request if required.
		_ = apiStream.GetRequest()
	}

	checkExpressionCondition(conditions, apiStream, p.reqExpressions)
	checkExpressionCondition(conditions, apiStream, p.resExpressions)
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
	log.Trace().Msgf("Condition for %s: %s", p.name, condition)

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

	p.bodyRequired = p.bodyRequired || p.body != ""
	if err := p.extractStatusCodeRangeParam(); err != nil {
		return err
	}

	var expressions []string
	if err := utils.ExtractListOfStringParam(p.metaData.Parameters,
		ExpressionsParam,
		&expressions); err != nil || len(expressions) == 0 {
		log.Trace().Msgf("request expressions not defined for %v", p.name)
	} else {
		for _, expression := range expressions {
			p.bodyRequired = p.bodyRequired || strings.Contains(expression, "body")

			if strings.HasPrefix(expression, "$.request") {
				p.reqExpressions = append(p.reqExpressions, strings.ReplaceAll(expression, "$.request", "$"))
			} else if strings.HasPrefix(expression, "$.response") {
				p.resExpressions = append(p.resExpressions, strings.ReplaceAll(expression, "$.response", "$"))
			}
		}
		log.Trace().Msgf("processor %v request expressions: %v", p.name, p.reqExpressions)
		log.Trace().Msgf("processor %v response expressions: %v", p.name, p.resExpressions)
	}

	if len(p.urls) == 0 && len(p.endpoints) == 0 && len(p.methods) == 0 && p.body == "" &&
		len(p.headers) == 0 && !p.isValidStatusCode() &&
		len(p.reqExpressions) == 0 && len(p.resExpressions) == 0 {
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
		log.Trace().Msgf("processor %v, status code range: %v-%v",
			p.name,
			p.statusCodeFrom,
			p.statusCodeTo)
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

	mapOfAny := make(map[string]any)
	_ = utils.ExtractMapOfAnyParam(p.metaData.Parameters, HeaderParam+"s", mapOfAny)
	for k, v := range mapOfAny {
		p.headers[k] = fmt.Sprintf("%v", v)
	}

	log.Trace().Msgf("filter headers defined for %v: %v", p.name, p.headers)
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
	if p.statusCodeFrom == 0 && p.statusCodeTo == 0 {
		return false // not defined
	}

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

// isFieldMatch checks if the inputField matches the filterField.
func isFieldMatch(filterField, inputField string) bool {
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

func checkExpressionCondition(
	conditions map_set.Set[string],
	apiStream publictypes.APIStreamI,
	expressions []string,
) {
	if len(expressions) == 0 {
		return
	}
	for _, expression := range expressions {
		result, err := apiStream.JSONPathQuery(expression)
		if err != nil {
			log.Trace().Msgf("failed to query JSON: %s", err)
			continue
		}
		if len(result) > 0 {
			log.Trace().Msgf("condition hit: expression %v in: %v", expression, result)
			conditions.Add(HitConditionName)
			return
		}
		expressionBodyMap := strings.Replace(expression, ".body.", ".body_map.", 1)
		resultBodyMap, errBodyMap := apiStream.JSONPathQuery(expressionBodyMap)
		if errBodyMap != nil {
			log.Trace().Msgf("failed to query JSON: %s", errBodyMap)
			continue
		}
		if len(resultBodyMap) > 0 {
			log.Trace().Msgf("condition hit: expression %v in: %v", expressionBodyMap, resultBodyMap)
			conditions.Add(HitConditionName)
			return
		}
	}
	log.Trace().Msgf("condition failed: no expression from %+v found in: %v",
		expressions,
		apiStream.GetBody())
	conditions.Add(MissConditionName)
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
		filterURLFieldLowCase := strings.ToLower(filterURLField)

		// check if the filterURLField is matched (equal or by regex or it's matched by a wildcard)
		if isFieldMatch(filterURLField, inputURL) {
			log.Trace().Msgf("URL filter %v accepts %v", filterURLField, inputURL)
			conditions.Add(HitConditionName)
			return
		}

		// check if the filterURLField is a regex pattern
		if !utils.ContainsRegexPattern(filterURLField) {
			parsedFilterURL, err := utils.ExtractDomainAndPath(filterURLFieldLowCase)
			if err != nil {
				log.Trace().Msgf("failed to extract domain and path from %v", filterURLFieldLowCase)
				continue
			}
			parsedInputURL, err := utils.ExtractDomainAndPath(inputURL)
			if err != nil {
				log.Trace().Msgf("failed to extract domain and path from %v", inputURL)
				continue
			}

			// match by host
			if isFieldMatch(parsedFilterURL.Host, parsedInputURL.Host) {
				if parsedFilterURL.Path != "" && !isFieldMatch(parsedFilterURL.Path, parsedInputURL.Path) ||
					parsedFilterURL.Scheme != "" &&
						!strings.EqualFold(parsedFilterURL.Scheme, parsedInputURL.Scheme) {
					log.Trace().Msgf("URL filter %v does not accept %v", filterURLFieldLowCase, inputURL)
					continue
				}

				log.Trace().Msgf("URL filter %v accepts %v", filterURLFieldLowCase, inputURL)
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
	log.Trace().Msgf("condition failed. Headers %v not match %v",
		filterHeaders,
		apiStream.GetHeaders())
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
