package harcollector

import (
	"context"
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/formats/har"
	"lunar/engine/streams/processors/utils"
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils/compression"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/otel"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"

	"github.com/goccy/go-json"
	"github.com/rs/zerolog/log"
	"github.com/samber/lo"
	"go.opentelemetry.io/otel/metric"

	lunar_metrics "lunar/engine/metrics"
	public_types "lunar/engine/streams/public-types"
	context_manager "lunar/toolkit-core/context-manager"
)

const (
	harVersion                string = "1.2"
	creatorName               string = "Lunar Har Exporter"
	exporterVersion           string = "1.0"
	limitationHTTPVersion     string = "HTTP:/1.1"
	contentEncodingHeaderName        = "content-encoding"
	contentTypeHeaderName            = "content-type"
	contentLengthHeaderName          = "content-length"
	gzipContentEncoding              = "gzip"

	exportAttempts           = 3
	exporterIDParam          = "exporter_id"
	transactionMaxSizeParam  = "transaction_max_size_bytes"
	obfuscateEnabledParam    = "obfuscate_enabled"
	obfuscateExclusionsParam = "obfuscate_exclusions"

	defaultFluentBitExporterTag = "file"

	dumpSizeMetric = "lunar_har_collector_processor_aggregated_har_dump_size"
)

var supportedFluentBitPlugins = map[string]string{
	"file":  "file",
	"cloud": "s3",
}

type harCollectorProcessor struct {
	name                string
	exporterID          string
	exporterTag         string
	transactionMaxSize  int
	obfuscateEnabled    bool
	obfuscateExclusions []string

	metaData     *streamtypes.ProcessorMetaData
	labelManager *lunar_metrics.LabelManager
	metricObject metric.Int64Counter

	mu                      sync.RWMutex
	aggregatedDumpSizeBytes int64
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	proc := &harCollectorProcessor{
		name:         metaData.Name,
		metaData:     metaData,
		labelManager: lunar_metrics.NewLabelManager(metaData.GetMetricLabels()),
	}

	if err := proc.init(); err != nil {
		return nil, err
	}

	err := proc.initializeMetrics()
	if err != nil {
		log.Error().Err(err).Msgf("failed to initialize metrics for %s", metaData.Name)
		proc.metaData.Metrics.Enabled = false
	}

	return proc, nil
}

func (p *harCollectorProcessor) GetName() string {
	return p.name
}

func (p *harCollectorProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{
		IsBodyRequired: true,
	}
}

func (p *harCollectorProcessor) Execute(
	flowName string,
	apiStream public_types.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	if apiStream.GetType() != public_types.StreamTypeResponse {
		return streamtypes.ProcessorIO{}, fmt.Errorf("invalid stream type: %s", apiStream.GetType())
	}
	noActionResp := streamtypes.ProcessorIO{
		Type:      apiStream.GetType(),
		ReqAction: &actions.NoOpAction{},
	}

	harObject, err := p.generateHAR(apiStream)
	if err != nil {
		log.Trace().Err(err).Msg("Failed to generate HAR object")
		noActionResp.Failure = true
		return noActionResp, nil
	}

	if err = p.ensureTransactionSize(harObject); err != nil {
		log.Trace().Err(err).Msg("Transaction size too large")
		noActionResp.Failure = true
		return noActionResp, nil
	}

	size, err := p.exportHAR(harObject)
	if err != nil {
		log.Trace().Err(err).Msg("Failed to export HAR object")
		noActionResp.Failure = true
		return noActionResp, nil
	}

	p.updateDumpSize(size)
	p.updateMetrics(flowName, apiStream)

	return noActionResp, nil
}

func (p *harCollectorProcessor) init() error {
	if err := utils.ExtractStrParam(p.metaData.Parameters,
		exporterIDParam,
		&p.exporterID); err != nil {
		log.Error().Err(err).Msgf("Missing %s parameter", exporterIDParam)
		return err
	}

	gatewayConfig, err := environment.LoadGatewayConfig()
	if err != nil {
		return err
	}
	for tag, exporter := range gatewayConfig.Exporters {
		if exporter.ExporterID == p.exporterID {
			p.exporterTag = supportedFluentBitPlugins[tag]
			break
		}
	}
	if p.exporterTag == "" {
		log.Warn().Msgf("Exporter %s not found, using file as default", p.exporterID)
		p.exporterTag = defaultFluentBitExporterTag
	}

	if err := utils.ExtractIntParam(p.metaData.Parameters,
		transactionMaxSizeParam,
		&p.transactionMaxSize); err != nil {
		log.Trace().Msgf("%s not defined for %v", transactionMaxSizeParam, p.name)
	}

	if err := utils.ExtractBoolParam(p.metaData.Parameters,
		obfuscateEnabledParam,
		&p.obfuscateEnabled); err != nil {
		log.Trace().Msgf("obfuscation disabled for %v", p.name)
	}

	if err := utils.ExtractListOfStringParam(p.metaData.Parameters,
		obfuscateExclusionsParam,
		&p.obfuscateExclusions); err != nil {
		log.Trace().Msgf("obfuscation exclusions not defined for %v", p.name)
	}

	return nil
}

func (p *harCollectorProcessor) initializeMetrics() error {
	log.Info().Msgf("Initializing metrics for %s", p.name)
	if !p.metaData.IsMetricsEnabled() {
		log.Info().Msgf("Metrics are disabled for %s", p.name)
		return nil
	}

	meter := otel.GetMeter()
	meterObj, err := meter.Int64Counter(
		dumpSizeMetric,
		metric.WithUnit("By"), // unit for bytes
		metric.WithDescription("Total aggregated HAR dump size in bytes"))
	if err != nil {
		return fmt.Errorf("failed to initialize below count metric: %w", err)
	}
	p.metricObject = meterObj

	log.Info().Msgf("Metrics initialized for %s", p.name)
	return nil
}

func (p *harCollectorProcessor) updateMetrics(
	flowName string,
	provider lunar_metrics.APICallMetricsProviderI,
) {
	if !p.metaData.IsMetricsEnabled() {
		return
	}

	dumpSize := p.getAggregatedDumpSize()

	attr := p.labelManager.GetProcessorMetricsAttributes(provider, flowName, p.name)
	p.metricObject.Add(context.Background(), dumpSize, metric.WithAttributes(attr...))
	log.Trace().Msgf("Metrics updated for %s", p.name)
}

func (p *harCollectorProcessor) exportHAR(harObject *har.HAR) (int, error) {
	marshalledRecord, err := json.Marshal(harObject)
	if err != nil {
		log.Error().Err(err).Msg("Failed to marshal HAR object")
		return 0, err
	}

	exporter := context_manager.Get().GetFileExporter()
	if exporter == nil {
		log.Error().Msg("Exporter not found")
		return 0, nil
	}

	var space byte = ' '
	var messageBytes []byte
	messageBytes = append(messageBytes, p.exporterID...)
	messageBytes = append(messageBytes, space)
	messageBytes = append(messageBytes, marshalledRecord...)

	for attempt := 0; attempt < exportAttempts; attempt++ {
		_, err = exporter.Write(messageBytes)
		if err == nil {
			return len(messageBytes), nil
		}
		log.Debug().Err(err).Msgf("Failed to write message, retrying (%d/%d)", attempt+1, exportAttempts)
	}
	return 0, err
}

func (p *harCollectorProcessor) updateDumpSize(size int) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.aggregatedDumpSizeBytes += int64(size)
}

func (p *harCollectorProcessor) getAggregatedDumpSize() int64 {
	p.mu.RLock()
	defer p.mu.RUnlock()

	return p.aggregatedDumpSizeBytes
}

// ensureTransactionSize ensures that the extracted HAR doesn't exceed configured transactionMaxSize
func (p *harCollectorProcessor) ensureTransactionSize(harObject *har.HAR) error {
	size := 0
	for _, value := range harObject.Log.Entries {
		size += value.Request.BodySize + value.Response.Size
	}

	log.Trace().Msgf("Current size: %v", size)
	log.Trace().Msgf("Max size allowed: %v", p.transactionMaxSize)

	if size > p.transactionMaxSize {
		return fmt.Errorf("transaction size too large. Got %v, max is %v", size, p.transactionMaxSize)
	}

	return nil
}

// generateHAR generates HAR object from the given API stream
func (p *harCollectorProcessor) generateHAR(apiStream public_types.APIStreamI) (*har.HAR, error) {
	request := apiStream.GetRequest()
	response := apiStream.GetResponse()

	if request == nil {
		return nil, fmt.Errorf("request not found")
	}

	if response == nil {
		return nil, fmt.Errorf("response not found")
	}

	parsedURL := request.GetParsedURL()
	if parsedURL == nil {
		return nil, fmt.Errorf("parsed URL not found")
	}

	apiStreamObfuscator := newAPIStreamObfuscator(p.obfuscateEnabled, p.obfuscateExclusions, apiStream)

	buildHARHeadersFunc := buildHARHeader(apiStreamObfuscator)
	headersRequest := lo.MapToSlice(request.GetHeaders(), buildHARHeadersFunc)
	headersResponse := lo.MapToSlice(response.GetHeaders(), buildHARHeadersFunc)

	query := buildHARQueryParams(parsedURL, apiStreamObfuscator)
	url := apiStreamObfuscator.ObfuscateURLPath(parsedURL)

	requestContentEncodingValue := request.GetHeaders()[contentEncodingHeaderName]
	responseContentEncodingValue := response.GetHeaders()[contentEncodingHeaderName]
	harReqBody := buildHARBody(
		request.GetBody(),
		requestContentEncodingValue,
		apiStreamObfuscator.ObfuscateRequestBody)

	req := har.Request{
		Method:      request.GetMethod(),
		URL:         url,
		HTTPVersion: limitationHTTPVersion,
		Headers:     headersRequest,
		QueryString: query,
		Body:        harReqBody,
		BodySize:    extractSize(request.GetHeaders()),
		HeadersSize: headersSize(request.GetHeaders()),
		Cookies:     []har.Cookie{},
	}

	harRespBody := buildHARBody(
		response.GetBody(),
		responseContentEncodingValue,
		apiStreamObfuscator.ObfuscateResponseBody,
	)
	res := har.Response{
		Status:      response.GetStatus(),
		StatusText:  http.StatusText(response.GetStatus()),
		HTTPVersion: limitationHTTPVersion,
		Headers:     headersResponse,
		Content:     harRespBody,
		Cookies:     []har.Cookie{},
		Size:        extractSize(response.GetHeaders()),
		MimeType:    extractMIMEType(response.GetHeaders()),
	}

	entry := har.Entry{
		StartedDateTime: request.GetTime(),
		Time:            response.GetTime().Sub(request.GetTime()),
		Request:         req,
		Response:        res,
	}

	return &har.HAR{
		Log: har.Log{
			Version: harVersion,
			Creator: har.Creator{
				Name:    creatorName,
				Version: exporterVersion,
				Comment: "",
			},
			Entries: []har.Entry{entry},
		},
	}, nil
}

func buildHARHeader(obfuscator *apiStreamObfuscator) func(k, v string) har.Header {
	return func(k, v string) har.Header {
		return har.Header{Name: k, Value: obfuscator.ObfuscateHeader(k, v)}
	}
}

func buildHARQueryParams(parsedURL *url.URL, obfuscator *apiStreamObfuscator) []har.Query {
	var queryString []har.Query
	for paramName, rawParamValues := range parsedURL.Query() {
		queryString = append(queryString, har.Query{
			Name:  paramName,
			Value: obfuscator.ObfuscateQueryParam(paramName, rawParamValues),
		})
	}
	return queryString
}

func buildHARBody(
	rawBody,
	contentEncHeaderValue string,
	obfuscationFunc func(string) string,
) string {
	body := ensureDecompressedBody(rawBody, contentEncHeaderValue)
	return obfuscationFunc(body)
}

// ensureDecompressedBody ensures that the body is decompressed.
// This function currently works only for `gzip` content encoding.
func ensureDecompressedBody(rawBody string, contentEncHeaderValue string) string {
	if contentEncHeaderValue == "" {
		return rawBody
	}

	// We only support exact matches and not nested compression
	// See MDN for more info https://tinyurl.com/2p9exttf
	if strings.ToLower(contentEncHeaderValue) != gzipContentEncoding {
		log.Debug().Msgf("Only gzip encoding currently supported, got: %s", contentEncHeaderValue)
		return rawBody
	}

	decompressedBody, err := compression.DecompressGZip(rawBody)
	if err != nil {
		log.Debug().Err(err).Msg("Failed to decompress body, will use original raw body")
		return rawBody
	}

	return decompressedBody
}

func extractMIMEType(headers map[string]string) string {
	contentTypeHeader, ok := headers[contentTypeHeaderName]
	if !ok {
		return ""
	}
	contentTypeParts := strings.Split(contentTypeHeader, ";")
	return strings.TrimSpace(contentTypeParts[0])
}

func extractSize(headers map[string]string) int {
	contentLengthHeader, ok := headers[contentLengthHeaderName]
	if !ok {
		return 0
	}
	size, err := strconv.Atoi(contentLengthHeader)
	if err != nil {
		return 0
	}
	return size
}

func headersSize(headers map[string]string) int {
	size := 0
	for key, value := range headers {
		size += len(key) + len(value)
	}
	return size
}
