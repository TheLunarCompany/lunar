package exporters

import (
	"context"
	"fmt"
	"lunar/engine/services/diagnoses"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const (
	labelNormalizedURL         = "normalized_url"
	labelMethod                = "method"
	labelStatusCode            = "status_code"
	lunarTransactionMetricName = "lunar_transaction"
	requestPrefix              = "request_"
	responsePrefix             = "response_"
)

type PrometheusExporter struct {
	ctx   context.Context
	meter metric.Meter
}

func NewPrometheusExporter(
	ctx context.Context,
	meter metric.Meter,
) *PrometheusExporter {
	return &PrometheusExporter{
		ctx:   ctx,
		meter: meter,
	}
}

func (exporter *PrometheusExporter) Export(
	diagnosisOutput diagnoses.DiagnosisOutput,
) error {
	record := diagnosisOutput.Metrics
	if record == nil {
		return fmt.Errorf("Record is undefined, cannot export")
	}

	baseAttrs := []attribute.KeyValue{
		attribute.Key(labelNormalizedURL).String(record.NormalizedURL),
		attribute.Key(labelMethod).String(record.Method),
		attribute.Key(labelStatusCode).Int(record.StatusCode),
	}

	err := exporter.recordLunarTransaction(record, baseAttrs)
	if err != nil {
		log.Debug().Err(err).Msg("Could not record lunar transaction")
	}
	exporter.incrementUserDefinedCounters(record, baseAttrs)

	log.Trace().Msg("📀 Successfully updated Prometheus metrics")

	return nil
}

func (exporter *PrometheusExporter) recordLunarTransaction(
	record *diagnoses.MetricsCollectorRecord,
	baseAttrs []attribute.KeyValue,
) error {
	histogram, err := exporter.meter.Int64Histogram(
		lunarTransactionMetricName,
		metric.WithDescription(
			"Histogram (& derived counter) of transactions runtime. "+
				"Global by host, Endpoint by normalized URL.",
		),
	)
	if err != nil {
		return err
	}

	mainMetricAttrs := baseAttrs

	for headerName, headerValue := range record.RequestHeaders {
		mainMetricAttrs = append(baseAttrs,
			attribute.Key(requestPrefix+headerName).String(headerValue))
	}

	for headerName, headerValue := range record.ResponseHeaders {
		mainMetricAttrs = append(baseAttrs,
			attribute.Key(responsePrefix+headerName).String(headerValue))
	}

	histogram.Record(
		context.Background(),
		record.DurationMillis,
		metric.WithAttributes(mainMetricAttrs...),
	)

	return nil
}

func (exporter PrometheusExporter) incrementUserDefinedCounters(
	record *diagnoses.MetricsCollectorRecord,
	baseAttrs []attribute.KeyValue,
) {
	for _, counterRecord := range record.Counters {
		log.Trace().
			Msgf("Exporting defined-counter %s of value %d",
				counterRecord.Name, counterRecord.Increment)
		counter, err := exporter.meter.Int64Counter(counterRecord.Name)
		if err != nil {
			log.Debug().
				Err(err).
				Msgf("Failed to obtain user-defined counter %s"+
					"will not increment counter", counterRecord.Name)
			continue
		}

		counter.Add(
			context.Background(),
			counterRecord.Increment,
			metric.WithAttributes(baseAttrs...),
		)
	}
}
