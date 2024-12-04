package diagnoses

import (
	"fmt"
	"lunar/engine/config"
	lunarMessages "lunar/engine/messages"
	"lunar/engine/utils"
	sharedConfig "lunar/shared-model/config"
	"strconv"
	"strings"

	"github.com/goccy/go-json"

	"github.com/rs/zerolog/log"
)

const (
	NotAvailable        = "N/A"
	lunarMetricPrefix   = "lunar"
	metricNameDelimiter = "_"
)

type MetricsCollectorPlugin struct{}

type MetricsCollectorRecord struct {
	Method          string            `json:"method"`
	NormalizedURL   string            `json:"normalized_url"`
	StatusCode      int               `json:"status_code"`
	DurationMillis  int64             `json:"duration_millis"`
	RequestHeaders  map[string]string `json:"request_headers"`
	ResponseHeaders map[string]string `json:"response_headers"`
	Counters        []Counter         `json:"counters"`
}

type Counter struct {
	Name      string
	Increment int64
}

func (plugin *MetricsCollectorPlugin) OnTransaction(
	onRequest lunarMessages.OnRequest,
	onResponse lunarMessages.OnResponse,
	_ *config.EndpointPolicyTree,
	scopedDiagnosis *config.ScopedDiagnosis,
) (*DiagnosisOutput, error) {
	diagnosisConfig := scopedDiagnosis.Diagnosis.Config.MetricsCollector
	if diagnosisConfig == nil {
		return nil, ErrMissingConfig
	}
	var normalizedURL string
	if scopedDiagnosis.Scope == utils.ScopeEndpoint {
		normalizedURL = scopedDiagnosis.NormalizedURL
	} else {
		parsedURL, err := onRequest.ParsedURL()
		if err != nil {
			log.Trace().Err(err).Msgf("Could not parse URL to obtain host "+
				"will report metric with %v as normalizedURL", NotAvailable)
			normalizedURL = NotAvailable
		} else {
			normalizedURL = parsedURL.Host
		}
	}
	requestHeaders := map[string]string{}
	userHeaders := utils.TransformSlice(diagnosisConfig.RequestHeaderNames, strings.ToLower)
	receivedHeaders := utils.MakeHeadersLowercase(onRequest.Headers)
	for _, headerName := range userHeaders {
		if headerValue, found := receivedHeaders[headerName]; found {
			requestHeaders[headerName] = headerValue
		}
	}

	responseHeaders := map[string]string{}
	userHeaders = utils.TransformSlice(diagnosisConfig.ResponseHeaderNames, strings.ToLower)
	receivedHeaders = utils.MakeHeadersLowercase(onResponse.Headers)
	for _, headerName := range userHeaders {
		if headerValue, found := receivedHeaders[headerName]; found {
			responseHeaders[headerName] = headerValue
		}
	}

	counters := []Counter{}
	for _, counterConfig := range diagnosisConfig.Counters {
		nameParts := []string{
			lunarMetricPrefix,
			counterConfig.PayloadType().String(),
			counterConfig.NameSuffix,
		}
		name := strings.Join(nameParts, metricNameDelimiter)
		switch counterConfig.PayloadType() {
		case sharedConfig.PayloadResponseHeaders:
			rawHeaderValue, found := onResponse.Headers[counterConfig.Key]
			if !found {
				continue
			}
			increment, err := strconv.ParseInt(rawHeaderValue, 10, 64)
			if err != nil {
				log.Debug().
					Msgf("Failed to parse int64 from header %s, raw value: %s,"+
						"will not increment counter %s",
						counterConfig.Key, rawHeaderValue, name)
				continue
			}
			counter := Counter{Name: name, Increment: increment}
			counters = append(counters, counter)
		case sharedConfig.PayloadRequestPathParams:
			log.Error().Msgf("not implemented")
			continue
		case sharedConfig.PayloadUndefined:
			log.Debug().
				Msgf("Payload undefined, will not increment counter %s", name)
			continue
		}
	}

	record := MetricsCollectorRecord{
		Method:          onRequest.Method,
		NormalizedURL:   normalizedURL,
		StatusCode:      onResponse.Status,
		DurationMillis:  onResponse.Time.Sub(onRequest.Time).Milliseconds(),
		RequestHeaders:  requestHeaders,
		ResponseHeaders: responseHeaders,
		Counters:        counters,
	}
	log.Trace().Msgf("Extracted MetricsCollectorRecord: %+v", record)

	diagnosisOutput := DiagnosisOutput{} //nolint:exhaustruct
	switch scopedDiagnosis.Diagnosis.ExporterKind() {
	case sharedConfig.ExporterKindMetrics:
		diagnosisOutput.Metrics = &record
	case sharedConfig.ExporterKindRawData:
		marshalledRecord, err := json.Marshal(record)
		if err != nil {
			return nil, err
		}
		diagnosisOutput.RawData = &marshalledRecord
	case sharedConfig.ExporterKindUndefined:
		return nil, fmt.Errorf("exporter type undefined")
	}

	return &diagnosisOutput, nil
}
