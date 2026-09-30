package filterprocessor

import (
	"context"
	"fmt"
	"lunar/engine/actions"
	lunar_metrics "lunar/engine/metrics"
	"lunar/engine/streams/processors/utils"
	public_types "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	lunar_utils "lunar/engine/utils"
	"lunar/toolkit-core/otel"
	"lunar/toolkit-core/urltree"
	"math/rand/v2"
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

	URLParam              = "url"
	EndpointParam         = "endpoint"
	MethodParam           = "method"
	QueryParams           = "query_params"
	PathParams            = "path_params"
	BodyParam             = "body"
	HeaderParam           = "header"
	ResponseHeadersParam  = "response_headers"
	StatusCodeParam       = "status_code"
	StatusCodeRangeParam  = "status_code_range" // legacy parameter. Backward compatibility
	ExpressionsParam      = "expressions"
	SamplePercentageParam = "sample_percentage"

	hitCountMetric  = "lunar_filter_processor_hit_count"
	missCountMetric = "lunar_filter_processor_miss_count"
)

var pathParamRegexp = regexp.MustCompile(`\{[^}]+\}`)

type filterProcessor struct {
	name                      string
	queryParams               public_types.KVOpParam
	pathParams                public_types.KVOpParam
	urls                      []string
	endpoints                 []string
	methods                   []string
	expressions               public_types.KVOpExpressionsParam
	requestHeaders            public_types.KVOpParam
	responseHeaders           public_types.KVOpParam
	numericHeaderKey          string
	numericHeaderComparisonOp string
	numericHeaderFilter       float64
	samplePercentage          float64
	body                      string
	bodyRequired              bool
	statusCodeParam           public_types.StatusCodeParam

	urlTree *urltree.URLTree[string]

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
		urlTree:       urltree.NewURLTree[string](false, 0),
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
	log.Trace().Bool("bodyRequired", p.bodyRequired).Msgf("body required: %v", p.bodyRequired)
	return &streamtypes.ProcessorRequirement{
		IsBodyRequired: p.bodyRequired,
	}
}

func (p *filterProcessor) Execute(
	flowName string,
	apiStream public_types.APIStreamI,
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
	checkExpressionCondition(conditions, apiStream, p.expressions)
	checkStrArrayCondition(conditions, apiStream.GetMethod, p.methods)
	checkCondition(conditions, apiStream.GetBody, p.body)
	checkStrArrayCondition(conditions, getEndpoint, p.endpoints)
	checkURLCondition(conditions, apiStream.GetURL, p.urls)
	checkPathParamsCondition(conditions, apiStream, p.pathParams, p.urlTree)
	if p.numericHeaderKey != "" {
		checkNumericHeaderCondition(conditions, apiStream, p.numericHeaderKey,
			p.numericHeaderComparisonOp, p.numericHeaderFilter)
	}

	p.checkHeadersCondition(conditions, apiStream)

	checkStatusCodeCondition(conditions, apiStream, p.statusCodeParam)

	checkQueryParamsCondition(conditions, apiStream, p.queryParams)

	checkSamplePercentageCondition(conditions, apiStream, p.samplePercentage)

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
	p.extractBodyParam()
	p.extractStatusCodeParam()
	p.extractExpressionsParam()

	if err := p.extractSamplePercentageParam(); err != nil {
		return err
	}

	if err := utils.ExtractKVOpParam(p.metaData.Parameters,
		QueryParams,
		&p.queryParams); err != nil || p.queryParams.IsEmpty() {
		log.Trace().Msgf("query params not defined for %v", p.name)
	}

	if err := utils.ExtractKVOpParam(p.metaData.Parameters,
		PathParams,
		&p.pathParams); err != nil || p.pathParams.IsEmpty() {
		log.Trace().Msgf("path params not defined for %v", p.name)
	}

	if err := utils.ExtractKVOpParam(p.metaData.Parameters,
		ResponseHeadersParam,
		&p.responseHeaders); err != nil || p.responseHeaders.IsEmpty() {
		log.Trace().Msgf("%v params not defined for %v", ResponseHeadersParam, p.name)
	}

	if !p.isFilterCriteriaDefined() {
		return fmt.Errorf("no filter criteria defined for %v", p.name)
	}
	return nil
}

func (p *filterProcessor) isFilterCriteriaDefined() bool {
	return len(p.urls) > 0 || len(p.endpoints) > 0 || len(p.methods) > 0 ||
		p.body != "" || p.statusCodeParam.IsValid() || !p.expressions.IsEmpty() ||
		p.numericHeaderKey != "" || p.numericHeaderComparisonOp != "" ||
		!p.queryParams.IsEmpty() || !p.requestHeaders.IsEmpty() || !p.responseHeaders.IsEmpty() ||
		p.samplePercentage > 0 || !p.pathParams.IsEmpty()
}

func (p *filterProcessor) extractBodyParam() {
	if err := utils.ExtractStrParam(p.metaData.Parameters,
		BodyParam,
		&p.body); err != nil {
		log.Trace().Msgf("body not defined for %v", p.name)
	}

	p.bodyRequired = p.bodyRequired || p.body != ""
}

// extractStatusCodeRangeParam extracts legacy status code range parameter from processor metadata
func (p *filterProcessor) extractStatusCodeRangeParam() error {
	var statusCodeRangeRaw string
	_ = utils.ExtractStrParam(p.metaData.Parameters,
		StatusCodeRangeParam, // legacy parameter. Backward compatibility
		&statusCodeRangeRaw)
	if statusCodeRangeRaw == "" {
		log.Trace().Msgf("%v not defined for %v", StatusCodeRangeParam, p.name)
		return nil
	}
	statusRange, err := public_types.NewStatusCodeRangeFromAny(statusCodeRangeRaw)
	if err != nil {
		return fmt.Errorf("failed to parse status code range: %w", err)
	}
	p.statusCodeParam.AddRange(*statusRange)
	return nil
}

func (p *filterProcessor) extractSamplePercentageParam() error {
	_ = utils.ExtractFloat64Param(p.metaData.Parameters, SamplePercentageParam, &p.samplePercentage)
	if p.samplePercentage == 0 {
		var sample int
		_ = utils.ExtractIntParam(p.metaData.Parameters, SamplePercentageParam, &sample)
		p.samplePercentage = float64(sample)
	}

	if p.samplePercentage == 0 {
		log.Trace().Msgf("sample percentage not defined for %v", p.name)
	}
	if p.samplePercentage < 0 || p.samplePercentage > 100 {
		return fmt.Errorf("sample percentage should be between 0 and 100 for %v", p.name)
	}
	log.Trace().Msgf("sample percentage defined for %v: %v", p.name, p.samplePercentage)
	return nil
}

func (p *filterProcessor) extractStatusCodeParam() {
	_ = utils.ExtractStatusCodeParam(p.metaData.Parameters,
		StatusCodeParam,
		&p.statusCodeParam)

	if err := p.extractStatusCodeRangeParam(); err != nil { // legacy support
		log.Trace().Err(err).Msgf("failed to extract %v for %v", StatusCodeRangeParam, p.name)
	}

	if p.statusCodeParam.IsEmpty() {
		log.Trace().Msgf("status code(s) not defined for %v", p.name)
	} else {
		log.Trace().Msgf("status code(s) defined for %v: %v", p.name, p.statusCodeParam)
	}
}

func (p *filterProcessor) extractExpressionsParam() {
	if err := utils.ExtractKVOpExpressionsParam(p.metaData.Parameters,
		ExpressionsParam,
		&p.expressions); err != nil || p.expressions.IsEmpty() {
		log.Trace().Msgf("%v params not defined for %v", ExpressionsParam, p.name)
	}

	p.bodyRequired = p.bodyRequired || p.expressions.IsBodyRequired()
}

func extractKeyValueForNumericComparison(raw string) (string, string, float64) {
	if raw == "" {
		return "", "", 0
	}
	parts := strings.Split(raw, "<=")
	if len(parts) == 2 {
		valToParse := strings.TrimSpace(parts[1])
		val, err := strconv.ParseFloat(valToParse, 64)
		if err != nil {
			log.Trace().Err(err).Msgf("failed to parse value: %s", valToParse)
			return "", "", 0
		}
		return strings.TrimSpace(parts[0]), "<=", val
	}

	parts = strings.Split(raw, ">=")
	if len(parts) == 2 {
		valToParse := strings.TrimSpace(parts[1])
		val, err := strconv.ParseFloat(valToParse, 64)
		if err != nil {
			log.Trace().Err(err).Msgf("failed to parse value: %s", valToParse)
			return "", "", 0
		}
		return strings.TrimSpace(parts[0]), ">=", val
	}
	parts = strings.Split(raw, "<")
	if len(parts) == 2 {
		valToParse := strings.TrimSpace(parts[1])
		val, err := strconv.ParseFloat(valToParse, 64)
		if err != nil {
			log.Trace().Err(err).Msgf("failed to parse value: %s", valToParse)
			return "", "", 0
		}
		return strings.TrimSpace(parts[0]), "<", val
	}
	parts = strings.Split(raw, ">")
	if len(parts) == 2 {
		valToParse := strings.TrimSpace(parts[1])
		val, err := strconv.ParseFloat(valToParse, 64)
		if err != nil {
			log.Trace().Err(err).Msgf("failed to parse value: %s", valToParse)
			return "", "", 0
		}
		return strings.TrimSpace(parts[0]), ">", val
	}
	return "", "", 0
}

func (p *filterProcessor) extractSingleOrMultipleHeadersParam() {
	var headerKeyVal string
	_ = utils.ExtractStrParam(p.metaData.Parameters, HeaderParam, &headerKeyVal)

	if headerKeyVal != "" {
		p.numericHeaderKey,
			p.numericHeaderComparisonOp,
			p.numericHeaderFilter = extractKeyValueForNumericComparison(headerKeyVal)
		if p.numericHeaderKey != "" && p.numericHeaderComparisonOp != "" {
			log.Trace().Msgf("filter %v has numeric header key: %v, comparison op: %v, filter: %v",
				p.name,
				p.numericHeaderKey,
				p.numericHeaderComparisonOp,
				p.numericHeaderFilter)
			return
		}
		headerKey, headerValue := utils.ExtractKeyValuePair(headerKeyVal)
		if headerKey != "" && headerValue != "" {
			kvOP := *public_types.NewKeyValueOperation(headerKey, headerValue, public_types.OpParamEq)
			p.requestHeaders.AddKVOp(kvOP)
		}
		return
	}

	err := utils.ExtractKVOpParam(p.metaData.Parameters, HeaderParam+"s", &p.requestHeaders)
	if err != nil || p.requestHeaders.IsEmpty() {
		log.Trace().Msgf("%vs params not defined as a KeyValueOp, trying legacy form", HeaderParam)

		// legacy support for headers as map[string]any
		mapOfAny := make(map[string]any)
		_ = utils.ExtractMapOfAnyParam(p.metaData.Parameters, HeaderParam+"s", mapOfAny)
		for k, v := range mapOfAny {
			kvOP := public_types.NewKeyValueOperation(k, fmt.Sprintf("%v", v), public_types.OpParamEq)
			p.requestHeaders.AddKVOp(*kvOP)
		}
	}

	if p.requestHeaders.IsEmpty() {
		log.Trace().Msgf("%vs param not defined for %v", HeaderParam, p.name)
		return
	}

	log.Trace().Msgf("filter headers defined for %v: %v", p.name, p.requestHeaders)
}

func (p *filterProcessor) extractSingleOrMultipleParam(param string, values *[]string) {
	var val string
	_ = utils.ExtractStrParam(p.metaData.Parameters, param, &val)

	if val != "" {
		*values = append(*values, val)
	} else {
		_ = utils.ExtractListOfStringParam(p.metaData.Parameters, param+"s", values)
	}

	if param == URLParam {
		for _, v := range *values {
			if err := p.urlTree.Insert(v, &v); err != nil {
				log.Error().Err(err).Msgf("failed to insert URL %s into URL tree for %s", v, p.name)
			}
		}
	}

	if len(*values) == 0 {
		log.Trace().Msgf("%s(s) not defined for %v", param, p.name)
	}
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

func (p *filterProcessor) checkHeadersCondition(
	conditions map_set.Set[string],
	apiStream public_types.APIStreamI,
) {
	var headersFilter public_types.KVOpParam
	var getValFunc public_types.GetValFunc
	if apiStream.GetType().IsRequestType() {
		getValFunc = apiStream.GetRequest().GetHeader
		headersFilter = p.requestHeaders
	} else {
		getValFunc = apiStream.GetResponse().GetHeader
		headersFilter = p.responseHeaders
	}

	if headersFilter.IsEmpty() {
		return
	}

	streamType := apiStream.GetType()
	streamName := apiStream.GetName()
	log.Trace().Msgf("checking %v headers for %s: %v", streamType, streamName, headersFilter)
	if ok := headersFilter.WithGetValFunc(getValFunc).EvaluateOpWithOrOperand(); ok {
		log.Trace().Msgf("condition hit: %v headers match for %s", streamType, streamName)
		conditions.Add(HitConditionName)
		return
	}
	log.Trace().Msgf("condition failed. %v headers not match for %s", streamType, streamName)
	conditions.Add(MissConditionName)
}

func checkExpressionCondition(
	conditions map_set.Set[string],
	apiStream public_types.APIStreamI,
	expressions public_types.KVOpExpressionsParam,
) {
	if expressions.IsEmpty() {
		return
	}

	if expressions.Validate(apiStream) {
		log.Trace().Msgf("condition hit: expression match for %s", apiStream.GetName())
		conditions.Add(HitConditionName)
		return
	}
	log.Trace().Msgf("condition failed. expressions not match")
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
		// path params sanitation for filter URL, so path parameters won't affect the match
		filterURLField = pathParamRegexp.ReplaceAllString(filterURLField, "*")

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

func checkNumericHeaderCondition(
	conditions map_set.Set[string],
	apiStream public_types.APIStreamI,
	headerKey, comparisonOp string,
	headerValue float64,
) {
	if headerKey == "" || comparisonOp == "" {
		return
	}

	hdrValue, found := apiStream.GetHeader(headerKey)
	if !found {
		log.Trace().Msgf("condition failed: header %v not found in request", headerKey)
		conditions.Add(MissConditionName)
		return
	}

	hdrValFloat, err := strconv.ParseFloat(hdrValue, 64)
	if err != nil {
		log.Trace().Err(err).Msgf("condition failed: header %v has invalid value %v", headerKey, hdrValue)
		conditions.Add(MissConditionName)
		return
	}
	switch comparisonOp {
	case "<=":
		if hdrValFloat <= headerValue {
			log.Trace().
				Msgf("condition hit: header %v value %v <= %v", headerKey, hdrValFloat, headerValue)
			conditions.Add(HitConditionName)
		} else {
			log.Trace().
				Msgf("condition failed: header %v value %v > %v", headerKey, hdrValFloat, headerValue)
			conditions.Add(MissConditionName)
		}
	case ">=":
		if hdrValFloat >= headerValue {
			log.Trace().
				Msgf("condition hit: header %v value %v >= %v", headerKey, hdrValFloat, headerValue)
			conditions.Add(HitConditionName)
		} else {
			log.Trace().
				Msgf("condition failed: header %v value %v < %v", headerKey, hdrValFloat, headerValue)
			conditions.Add(MissConditionName)
		}
	case "<":
		if hdrValFloat < headerValue {
			log.Trace().
				Msgf("condition hit: header %v value %v < %v", headerKey, hdrValFloat, headerValue)
			conditions.Add(HitConditionName)
		} else {
			log.Trace().
				Msgf("condition failed: header %v value %v >= %v", headerKey, hdrValFloat, headerValue)
			conditions.Add(MissConditionName)
		}
	case ">":
		if hdrValFloat > headerValue {
			log.Trace().
				Msgf("condition hit: header %v value %v > %v", headerKey, hdrValFloat, headerValue)
			conditions.Add(HitConditionName)
		} else {
			log.Trace().
				Msgf("condition failed: header %v value %v <= %v", headerKey, hdrValFloat, headerValue)
			conditions.Add(MissConditionName)
		}
	default:
		log.Trace().
			Msgf("condition failed: header %v uses not supported operation %v", headerKey, comparisonOp)
		conditions.Add(MissConditionName)
	}
}

func checkStatusCodeCondition(
	conditions map_set.Set[string],
	apiStream public_types.APIStreamI,
	statusCodeParam public_types.StatusCodeParam,
) {
	if apiStream.GetType().IsRequestType() {
		return
	}

	if statusCodeParam.IsEmpty() {
		return
	}

	response := apiStream.GetResponse()
	if lunar_utils.IsInterfaceNil(response) {
		return
	}

	status := response.GetStatus()
	if statusCodeParam.Contains(status) {
		log.Trace().Msgf("condition hit: Status %v in %v", status, statusCodeParam)
		conditions.Add(HitConditionName)
		return
	}

	log.Trace().Msgf("condition failed: Status %v not in %v", status, statusCodeParam)
	conditions.Add(MissConditionName)
}

func checkSamplePercentageCondition(
	conditions map_set.Set[string],
	_ public_types.APIStreamI,
	percentage float64,
) {
	if percentage == 0 {
		return
	}

	if rand.Float64()*100 <= percentage {
		log.Trace().Msgf("condition hit: sample percentage %v allows this request", percentage)
		conditions.Add(HitConditionName)
		return
	}

	log.Trace().Msgf("condition failed: sample percentage %v not allows this request", percentage)
	conditions.Add(MissConditionName)
}

func checkPathParamsCondition(
	conditions map_set.Set[string],
	apiStream public_types.APIStreamI,
	pathParams public_types.KVOpParam,
	urlTree *urltree.URLTree[string],
) {
	if apiStream.GetType().IsResponseType() {
		return
	}
	if pathParams.IsEmpty() {
		return
	}

	var pathParamsToCheck map[string]string
	if res := urlTree.Lookup(apiStream.GetURL()); res.Match {
		pathParamsToCheck = res.PathParams
	}

	if len(pathParamsToCheck) == 0 {
		log.Trace().Msgf("no filter path_params for Stream/Processor for %s", apiStream.GetURL())
		return
	}

	log.Trace().Msgf("checking path params for %s: %v", apiStream.GetName(), pathParamsToCheck)
	if match := pathParams.WithKVData(pathParamsToCheck).EvaluateOpWithOrOperand(); match {
		conditions.Add(HitConditionName)
		return
	}
	conditions.Add(MissConditionName)
}

func checkQueryParamsCondition(
	conditions map_set.Set[string],
	apiStream public_types.APIStreamI,
	queryParams public_types.KVOpParam,
) {
	if apiStream.GetType().IsResponseType() {
		return
	}

	if queryParams.IsEmpty() {
		return
	}

	req := apiStream.GetRequest()
	log.Trace().Msgf("checking query params for %s: %v", apiStream.GetName(), queryParams)
	if match := queryParams.WithGetValFunc(req.GetQueryParam).EvaluateOpWithOrOperand(); match {
		log.Trace().Msgf("condition hit: query params match for %s", apiStream.GetName())
		conditions.Add(HitConditionName)
		return
	}

	log.Trace().Msgf("condition failed. query params not match")
	conditions.Add(MissConditionName)
}
