package diagnoses

import (
	"fmt"
	"lunar/engine/config"
	"lunar/engine/formats/har"
	lunarMessages "lunar/engine/messages"
	"lunar/engine/utils/compression"
	"lunar/engine/utils/obfuscation"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/typing"
	"lunar/toolkit-core/urltree"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/goccy/go-json"

	"github.com/rs/zerolog/log"
	"github.com/samber/lo"
)

const (
	harVersion                       string = "1.2"
	creatorName                      string = "Lunar Har Exporter"
	exporterVersion                  string = "1.0"
	limitationHTTPVersion            string = "HTTP:/1.1"
	defaultContentEncodingHeaderName        = "Content-Encoding"
	gzipContentEncoding                     = "gzip"
)

type HARGeneratorPlugin struct {
	clock      clock.Clock
	obfuscator obfuscation.Obfuscator
}

func NewHARGeneratorPlugin(
	clock clock.Clock,
	obfuscator obfuscation.Obfuscator,
) *HARGeneratorPlugin {
	return &HARGeneratorPlugin{
		clock:      clock,
		obfuscator: obfuscator,
	}
}

func (plugin *HARGeneratorPlugin) validate(
	diagnoseConfig *sharedConfig.HARExporterConfig,
) error {
	if diagnoseConfig.TransactionMaxSize < 0 {
		return fmt.Errorf("TransactionMaxSize must be a positive integer")
	}
	return nil
}

func (plugin *HARGeneratorPlugin) OnTransaction(
	onRequest lunarMessages.OnRequest,
	onResponse lunarMessages.OnResponse,
	policyTree *config.EndpointPolicyTree,
	scopedDiagnosis *config.ScopedDiagnosis,
) (*DiagnosisOutput, error) {
	diagnoseConfig := scopedDiagnosis.Diagnosis.Config.HARExporter
	if err := plugin.validate(diagnoseConfig); err != nil {
		return nil, err
	}

	HARObject, generationErr := plugin.GenerateHAR(
		onRequest,
		onResponse,
		policyTree,
		diagnoseConfig,
	)

	if generationErr != nil {
		return nil, generationErr
	}

	ensureErr := ensureTransactionSize(
		HARObject,
		diagnoseConfig.TransactionMaxSize,
	)
	if ensureErr != nil {
		return nil, ensureErr
	}

	diagnosisOutput := DiagnosisOutput{} //nolint:exhaustruct
	var err error

	// in the future we might support more than a single exporter per
	// diagnosis plugin. We would need to amend this part, and also
	// take into account error chaining.
	switch scopedDiagnosis.Diagnosis.ExporterKind() {
	case sharedConfig.ExporterKindRawData:
		marshalledRecord, er := json.Marshal(HARObject)
		err = er
		diagnosisOutput.RawData = &marshalledRecord
	case sharedConfig.ExporterKindMetrics, sharedConfig.ExporterKindUndefined:
		err = fmt.Errorf("unsupported exporter type")
	}

	if err != nil {
		return nil, err
	}
	return &diagnosisOutput, err
}

func ensureTransactionSize(HARObject *har.HAR, maxSize int) error {
	size := 0
	for _, value := range HARObject.Log.Entries {
		size += value.Request.BodySize + value.Response.Size
	}

	// Validate that the extracted HAR object
	// does not exceed configured `TransactionMaxSize`
	log.Trace().Msgf("Current size: %v", size)
	log.Trace().Msgf("Max size allowed: %v", maxSize)

	if size > maxSize {
		return fmt.Errorf("transaction size too large. Got %v, max is %v",
			size, maxSize)
	}

	return nil
}

func buildHeaderBuilder(
	shouldObfuscate func(header string) bool,
	obfuscate func(value string) string,
) func(k, v string) har.Header {
	return func(k, v string) har.Header {
		if shouldObfuscate(k) {
			return har.Header{Name: k, Value: obfuscate(v)}
		}
		return har.Header{Name: k, Value: v}
	}
}

func (plugin *HARGeneratorPlugin) GenerateHAR(
	request lunarMessages.OnRequest,
	response lunarMessages.OnResponse,
	policyTree *config.EndpointPolicyTree,
	diagnosisConfig *sharedConfig.HARExporterConfig,
) (*har.HAR, error) {
	obfuscateConfig := diagnosisConfig.Obfuscate
	buildRequestHeader := buildHeaderBuilder(
		config.ShouldObfuscateRequestHeader(obfuscateConfig),
		plugin.obfuscator.ObfuscateString,
	)

	buildResponseHeader := buildHeaderBuilder(
		config.ShouldObfuscateResponseHeader(obfuscateConfig),
		plugin.obfuscator.ObfuscateString,
	)

	headersRequest := lo.MapToSlice(request.Headers, buildRequestHeader)
	headersResponse := lo.MapToSlice(response.Headers, buildResponseHeader)

	urlWithQueryString := fmt.Sprintf(
		"%s://%s?%s",
		request.Scheme,
		request.URL,
		request.Query,
	)
	parsedURL, err := url.Parse(urlWithQueryString)
	if err != nil {
		return nil, err
	}
	log.Trace().Msgf("parsedURL: %+v", parsedURL)

	query := plugin.extractQueryParams(parsedURL, &obfuscateConfig)
	url := plugin.extractURL(parsedURL, policyTree, &obfuscateConfig)

	requestContentEncodingValue := extractContentEncodingValue(
		request.Headers,
		diagnosisConfig.RequestHeaderNames,
	)
	req := har.Request{
		Method:      request.Method,
		URL:         url,
		HTTPVersion: limitationHTTPVersion,
		Headers:     headersRequest,
		QueryString: query,
		Body: plugin.extractBody(
			request.Body,
			obfuscateConfig.Enabled,
			obfuscateConfig.Exclusions.RequestBodyPaths,
			requestContentEncodingValue,
		),
		BodySize:    extractSize(request.Headers),
		HeadersSize: headersSize(request.Headers),
		Cookies:     []har.Cookie{}, // Todo: We should fill this?
	}

	responseContentEncodingValue := extractContentEncodingValue(
		response.Headers,
		diagnosisConfig.ResponseHeaderNames,
	)
	res := har.Response{
		Status:      response.Status,
		StatusText:  http.StatusText(response.Status),
		HTTPVersion: limitationHTTPVersion,
		Headers:     headersResponse,
		Content: plugin.extractBody(
			response.Body,
			obfuscateConfig.Enabled,
			obfuscateConfig.Exclusions.ResponseBodyPaths,
			responseContentEncodingValue,
		),
		Cookies:  []har.Cookie{}, // Todo: Should we fill this?
		Size:     extractSize(response.Headers),
		MimeType: extractMIMEType(response.Headers),
	}

	entry := har.Entry{
		StartedDateTime: request.Time,
		Time:            response.Time.Sub(request.Time),
		Request:         req,
		Response:        res,
	}

	har := &har.HAR{
		Log: har.Log{
			Version: harVersion,
			Creator: har.Creator{
				Name:    creatorName,
				Version: exporterVersion,
				Comment: "",
			},
			Entries: []har.Entry{entry},
		},
	}

	return har, nil
}

func extractContentEncodingValue(
	headers map[string]string,
	headerNames sharedConfig.HeaderNames,
) string {
	contentEncodingHeaderName := headerNames.ContentEncoding
	if contentEncodingHeaderName == "" {
		contentEncodingHeaderName = defaultContentEncodingHeaderName
	}

	contentEncoding, found := headers[contentEncodingHeaderName]
	if found {
		return contentEncoding
	}

	contentEncoding = headers[strings.ToLower(contentEncodingHeaderName)]
	return contentEncoding
}

func (plugin *HARGeneratorPlugin) extractQueryParams(
	parsedURL *url.URL,
	obfuscateConfig *sharedConfig.Obfuscate,
) []har.Query {
	var queryString []har.Query

	// TODO: can this be declared once?
	obfuscate := typing.WithArg[int](plugin.obfuscator.ObfuscateString)
	for paramName, rawParamValues := range parsedURL.Query() {
		var values []string
		if config.ShouldObfuscateQueryParam(*obfuscateConfig)(paramName) {
			values = lo.Map(rawParamValues, obfuscate)
		} else {
			values = rawParamValues
		}
		queryString = append(
			queryString,
			har.Query{Name: paramName, Value: values},
		)
	}
	return queryString
}

func (plugin *HARGeneratorPlugin) extractURL(
	parsedURL *url.URL,
	policyTree *config.EndpointPolicyTree,
	obfuscateConfig *sharedConfig.Obfuscate,
) string {
	if !obfuscateConfig.Enabled {
		return fmt.Sprintf(
			"%s://%s%s",
			parsedURL.Scheme,
			parsedURL.Host,
			parsedURL.Path,
		)
	}

	// Obfuscation is required
	lookup := policyTree.Lookup(
		fmt.Sprintf("%s%s", parsedURL.Host, parsedURL.Path),
	)
	knownURLParts := strings.Split(strings.Trim(lookup.NormalizedURL, "/"), "/")

	var knownPathParts []string
	if len(knownURLParts) == 1 && knownURLParts[0] == "" {
		// When split yielded no result
		knownPathParts = []string{}
	} else {
		// Drop first item in slice since it represents host and not path
		knownPathParts = knownURLParts[1:]
	}

	currentCleanPath := strings.Trim(parsedURL.Path, "/")
	currentPathParts := strings.Split(currentCleanPath, "/")

	var obfuscatedPathParts []string
	log.Trace().Msgf("currentPathParts: %+v", currentPathParts)
	log.Trace().Msgf("knownPathParts: %+v", knownPathParts)
	tuples := lo.Zip2(currentPathParts, knownPathParts)

	pathsMatch := true
	for _, tuple := range tuples {
		currentPathPart := tuple.A
		knownPathPart := tuple.B
		if pathsMatch {
			// Detect recognized constant path parts -
			// these should not appear obfuscated.
			if currentPathPart == knownPathPart {
				obfuscatedPathParts = append(
					obfuscatedPathParts,
					currentPathPart,
				)
				continue
			}

			// If part is not a recognized constant,
			// try to detect recognized parametric path parts
			pathParam, isPathParam := urltree.TryExtractPathParameter(
				knownPathPart,
			)
			if isPathParam {
				// Param should always be found, this is more of a shortage in the modeling
				// rather than a real code path.
				// TODO: think of a way to remodel this in order to
				// make illegal state irrepresentable.
				paramValue, found := lookup.PathParams[pathParam]
				if !found {
					log.Error().
						Msgf("didn't find path param %v in extracted path params", pathParam)
				}
				// Even if param was not found, we still want to append a value.
				// paramValue will have string's zero value in that case.
				// This value will appear obfuscated as it may hold sensitive data.
				pathPart := paramValue
				if config.ShouldObfuscatePathParam(
					*obfuscateConfig,
				)(
					pathParam,
				) {
					pathPart = plugin.obfuscator.ObfuscateString(paramValue)
				}
				obfuscatedPathParts = append(obfuscatedPathParts, pathPart)
				continue
			}
			// If we didn't `continue` up till here,
			// we recognize a divergence in the paths
			pathsMatch = false
		}

		// Any part which is on its own diverged track should be obfuscated,
		// since we cannot make any assumption about it
		obfuscatedPathParts = append(
			obfuscatedPathParts,
			plugin.obfuscator.ObfuscateString(currentPathPart),
		)
	}

	obfuscatedPath := strings.Join(obfuscatedPathParts, "/")
	return fmt.Sprintf(
		"%s://%s/%s",
		parsedURL.Scheme,
		parsedURL.Host,
		obfuscatedPath,
	)
}

func (plugin *HARGeneratorPlugin) extractBody(
	rawBody string,
	obfuscationEnabled bool,
	obfuscationExcludedBodyPath []string,
	contentEncodingHeaderValue string,
) string {
	body := ensureDecompressedBody(rawBody, contentEncodingHeaderValue)

	if !obfuscationEnabled {
		return body
	}
	obfuscatedJSON, err := plugin.obfuscator.ObfuscateJSON(
		body,
		obfuscationExcludedBodyPath,
	)
	if err != nil {
		log.Debug().Err(err).Msg("Failed to obfuscate body JSON, " +
			"will return obfuscated raw body string")
		return plugin.obfuscator.ObfuscateString(body)
	}

	return obfuscatedJSON
}

// This function currently works only for `gzip` content encoding.
// A more complete implementation is reflected in
// https://lunar-shots.atlassian.net/browse/MK-412
func ensureDecompressedBody(
	rawBody string,
	contentEncodingHeaderValue string,
) string {
	if contentEncodingHeaderValue == "" {
		return rawBody
	}

	// We only support exact matches and not nested compression
	// See MDN for more info https://tinyurl.com/2p9exttf
	if contentEncodingHeaderValue != gzipContentEncoding {
		log.Debug().
			Msgf("Only gzip encoding is currently supported, got: %s",
				contentEncodingHeaderValue)
		return rawBody
	}

	decompressedBody, err := compression.DecompressGZip(rawBody)
	if err != nil {
		log.Debug().
			Err(err).
			Msg("Failed to decompress body, will use original raw body")
		return rawBody
	}

	return decompressedBody
}

func extractMIMEType(headers map[string]string) string {
	contentTypeHeader, ok := headers["Content-Type"]
	if !ok {
		return ""
	}
	contentTypeParts := strings.Split(contentTypeHeader, ";")
	return strings.TrimSpace(contentTypeParts[0])
}

func extractSize(headers map[string]string) int {
	contentLengthHeader, ok := headers["Content-Length"]
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
