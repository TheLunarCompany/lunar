package diagnoses

import (
	"fmt"
	"lunar/engine/config"
	"lunar/engine/messages"
	"lunar/engine/utils"
	sharedConfig "lunar/shared-model/config"

	"github.com/goccy/go-json"

	"github.com/rs/zerolog/log"
)

const NotAvailable = "N/A"

type MetricsCollectorPlugin struct{}

type MetricsCollectorRecord struct {
	Method         string            `json:"method"`
	NormalizedURL  string            `json:"normalized_url"`
	StatusCode     int               `json:"status_code"`
	DurationMillis int64             `json:"duration_millis"`
	RequestHeaders map[string]string `json:"request_headers"`
}

func (plugin *MetricsCollectorPlugin) OnTransaction(
	onRequest messages.OnRequest,
	onResponse messages.OnResponse,
	_ *config.EndpointPolicyTree,
	scopedDiagnosis *config.ScopedDiagnosis,
) (*DiagnosisOutput, error) {
	var normalizedURL string
	if scopedDiagnosis.Scope == utils.ScopeEndpoint {
		normalizedURL = scopedDiagnosis.NormalizedURL
	} else {
		parsedURL, err := onRequest.ParsedURL()
		if err != nil {
			log.Warn().Err(err).Msgf("Could not parse URL to obtain host"+
				"will report metric with %v as normalizedURL", NotAvailable)
			normalizedURL = NotAvailable
		} else {
			normalizedURL = parsedURL.Host
		}
	}
	requestHeaders := map[string]string{}
	for _, headerName := range scopedDiagnosis.Diagnosis.Config.MetricsCollector.RequestHeaderNames { //nolint:lll
		if headerValue, found := onRequest.Headers[headerName]; found {
			requestHeaders[headerName] = headerValue
		}
	}

	record := MetricsCollectorRecord{
		Method:         onRequest.Method,
		NormalizedURL:  normalizedURL,
		StatusCode:     onResponse.Status,
		DurationMillis: onResponse.Time.Sub(onRequest.Time).Milliseconds(),
		RequestHeaders: requestHeaders,
	}
	log.Debug().Msgf("Extracted MetricsCollectorRecord: %+v", record)

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
