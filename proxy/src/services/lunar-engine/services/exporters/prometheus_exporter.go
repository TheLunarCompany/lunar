package exporters

import (
	"context"
	"fmt"
	"lunar/engine/services/diagnoses"
	"lunar/toolkit-core/otel"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric/instrument"
)

const (
	labelNormalizedURL = "normalized_url"
	labelMethod        = "method"
	labelStatusCode    = "status_code"
)

type PrometheusExporter struct{}

func (exporter *PrometheusExporter) Export(
	diagnosisOutput diagnoses.DiagnosisOutput,
) error {
	record := diagnosisOutput.Metrics
	if record == nil {
		return fmt.Errorf("Record is undefined, cannot export")
	}
	// TODO: Discuss - do we care about context in this... context? 😏
	ctx := context.Background()
	meter := otel.GetMeter()

	histogram, err := meter.Int64Histogram(
		"lunar_transaction",
		instrument.WithDescription(
			"Histogram (& derived counter) of transactions runtime. "+
				"Global by host, Endpoint by normalized URL.",
		),
	)
	if err != nil {
		return err
	}

	attrs := []attribute.KeyValue{
		attribute.Key(labelNormalizedURL).String(record.NormalizedURL),
		attribute.Key(labelMethod).String(record.Method),
		attribute.Key(labelStatusCode).Int(record.StatusCode),
	}

	for headerName, headerValue := range record.RequestHeaders {
		attrs = append(attrs,
			attribute.Key(headerName).String(headerValue))
	}

	histogram.Record(ctx, record.DurationMillis, attrs...)

	log.Debug().Msg("📀 Successfully recorded transaction metrics in Prometheus")

	return nil
}
