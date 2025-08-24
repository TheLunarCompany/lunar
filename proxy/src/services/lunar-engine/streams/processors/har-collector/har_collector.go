package harcollector

import (
	"context"
	"encoding/base64"
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
	"time"
	"unicode/utf8"

	"github.com/goccy/go-json"
	"github.com/rs/zerolog/log"
	"github.com/samber/lo"
	"go.opentelemetry.io/otel/metric"

	lunar_metrics "lunar/engine/metrics"
	public_types "lunar/engine/streams/public-types"
	context_manager "lunar/toolkit-core/context-manager"
)

const (
	limitationHTTPVersion     = "HTTP/1.1"
	contentEncodingHeaderName = "content-encoding"
	contentTypeHeaderName     = "content-type"
	defaultContentType        = "application/octet-stream"
	contentLengthHeaderName   = "content-length"
	gzipContentEncoding       = "gzip"

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

	harEntry, err := p.generateHAREntry(apiStream)
	if err != nil {
		log.Trace().Err(err).Msg("Failed to generate HAR object")
		noActionResp.Failure = true
		return noActionResp, nil
	}

	if err = p.ensureTransactionSize(harEntry); err != nil {
		log.Trace().Err(err).Msg("Transaction size too large")
		noActionResp.Failure = true
		return noActionResp, nil
	}

	size, err := p.exportHAR(harEntry)
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

func (p *harCollectorProcessor) exportHAR(harEntry *har.Entry) (int, error) {
	marshalledRecord, err := json.Marshal(harEntry)
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
func (p *harCollectorProcessor) ensureTransactionSize(harObject *har.Entry) error {
	size := harObject.Request.BodySize + harObject.Response.Content.Size

	log.Trace().Msgf("Current size: %v", size)
	log.Trace().Msgf("Max size allowed: %v", p.transactionMaxSize)

	if size > int64(p.transactionMaxSize) {
		return fmt.Errorf("transaction size too large. Got %v, max is %v", size, p.transactionMaxSize)
	}

	return nil
}

// generateHAREntry generates HAR entry object from the given API stream
func (p *harCollectorProcessor) generateHAREntry(apiStream public_types.APIStreamI) (*har.Entry, error) {
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
	rawReqBody := request.GetBody()
	// only build postData if there actually is a non‐GET body
	var harReqBody *har.PostData
	if rawReqBody != "" && request.GetMethod() != http.MethodGet {
		harReqBody = buildRequestHARBody(
			rawReqBody,
			extractMIMEType(request.GetHeaders()),
			requestContentEncodingValue,
			apiStreamObfuscator.ObfuscateRequestBody,
		)
	}

	req := har.Request{
		Method:      request.GetMethod(),
		URL:         url,
		HTTPVersion: limitationHTTPVersion,
		Headers:     headersRequest,
		QueryString: query,
		PostData:    harReqBody,
		BodySize:    extractBodySize(request.GetHeaders(), rawReqBody),
		HeadersSize: headersSize(request.GetHeaders()),
		Cookies:     []har.Cookie{},
	}

	rawResBody := response.GetBody()
	harRespContent := buildResponseHARContent(
		rawResBody,
		extractMIMEType(response.GetHeaders()),
		responseContentEncodingValue,
		apiStreamObfuscator.ObfuscateResponseBody,
	)
	res := har.Response{
		Status:      response.GetStatus(),
		StatusText:  http.StatusText(response.GetStatus()),
		HTTPVersion: limitationHTTPVersion,
		Headers:     headersResponse,
		Content:     harRespContent,
		Cookies:     []har.Cookie{},
		HeadersSize: headersSize(response.GetHeaders()),
		BodySize:    extractBodySize(response.GetHeaders(), rawResBody),
	}

	timeMs := response.GetTime().Sub(request.GetTime()).Seconds() * 1e3 // milliseconds
	entry := har.Entry{
		StartedDateTime: request.GetTime().Format(time.RFC3339), // ISO8601 format
		Time:            timeMs,
		Request:         req,
		Response:        res,
		Timings: har.Timings{
			Blocked: -1,
			DNS:     -1,
			Connect: -1,
			Send:    -1,
			Wait:    timeMs,
			Receive: -1,
			SSL:     -1,
		},
	}

	return &entry, nil
}

// buildResponseHARContent constructs a HAR Content object from the raw bytes
// exactly as received ("rawBody"), handling decompression,
// computing true size, and obfuscating only afterwards.
func buildResponseHARContent(
	rawBody,
	mimeType,
	contentEncHeaderValue string,
	obfuscationFunc func(string) string,
) har.Content {
	rawBytes := []byte(rawBody)
	size := int64(len(rawBytes))

	// decompress to get the true body before obfuscation
	decompressedStr := ensureDecompressedBody(rawBody, contentEncHeaderValue)

	// unmodified decompressedBytes bytes for compression calc
	decompressedBytes := []byte(decompressedStr)

	// obfuscate the decompressed text
	obfStr := obfuscationFunc(decompressedStr)
	obfBytes := []byte(obfStr)

	// compression = raw - uncompressed
	var compression int64
	if size > int64(len(decompressedBytes)) {
		compression = size - int64(len(decompressedBytes))
	}

	// text vs base64 on the obfuscated bytes
	var text, encoding string
	if utf8.Valid(obfBytes) {
		text = obfStr
	} else {
		text = base64.StdEncoding.EncodeToString(obfBytes)
		encoding = "base64"
	}

	return har.Content{
		Size:        size,
		Compression: compression,
		MimeType:    mimeType,
		Text:        text,
		Encoding:    encoding,
	}
}
func buildHARHeader(obfuscator *apiStreamObfuscator) func(k, v string) har.Header {
	return func(k, v string) har.Header {
		return har.Header{Name: k, Value: obfuscator.ObfuscateHeader(k, v)}
	}
}

func buildHARQueryParams(parsedURL *url.URL, obfuscator *apiStreamObfuscator) []har.Query {
	queryString := make([]har.Query, 0)
	for paramName, rawParamValues := range parsedURL.Query() {
		obfValues := obfuscator.ObfuscateQueryParam(paramName, rawParamValues)
		// one har.Query per value
		for _, v := range obfValues {
			queryString = append(queryString, har.Query{
				Name:  paramName,
				Value: v,
			})
		}
	}
	return queryString

}

func buildRequestHARBody(
	rawBody,
	mimeType,
	contentEncHeaderValue string,
	obfuscationFunc func(string) string,
) *har.PostData {
	body := ensureDecompressedBody(rawBody, contentEncHeaderValue)
	obf := obfuscationFunc(body)

	postData := &har.PostData{ // ← start building your PostData
		MimeType: mimeType,
	}

	switch mimeType {
	case "application/x-www-form-urlencoded": // form-data -> params
		vals, _ := url.ParseQuery(obf)
		for name, values := range vals {
			for _, v := range values {
				postData.Params = append(postData.Params, har.Param{
					Name:  name,
					Value: v,
				})
			}
		}
	default: //everything else -> Text
		postData.Text = obf
	}

	return postData
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
		return defaultContentType
	}
	contentTypeParts := strings.Split(contentTypeHeader, ";")
	return strings.TrimSpace(contentTypeParts[0])
}

func extractBodySize(headers map[string]string, rawBody string) int64 {
	contentLengthHeader, ok := headers[contentLengthHeaderName]
	if !ok {
		return int64(len(rawBody))
	}
	int64Size, err := strconv.ParseInt(contentLengthHeader, 10, 64)
	if err != nil {
		return int64(len(rawBody))
	}
	return int64Size
}

func headersSize(headers map[string]string) int64 {
	size := 0
	for key, value := range headers {
		size += len(key)   // length of "Key"
		size += 2          // for ": "
		size += len(value) // length of "Value"
		size += 2          // for "\r\n"
	}
	// add final blank line between headers and body:
	size += 2 // "\r\n"
	return int64(size)
}
