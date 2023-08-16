package exporters

import (
	"context"
	"fmt"
	"lunar/engine/services/diagnoses"
	"lunar/toolkit-core/otel"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/metric/instrument"
)

const (
	labelNormalizedURL         = "normalized_url"
	labelMethod                = "method"
	labelStatusCode            = "status_code"
	lunarTransactionMetricName = "lunar_transaction"
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

	baseAttrs := []attribute.KeyValue{
		attribute.Key(labelNormalizedURL).String(record.NormalizedURL),
		attribute.Key(labelMethod).String(record.Method),
		attribute.Key(labelStatusCode).Int(record.StatusCode),
	}

	err := RecordLunarTransaction(ctx, meter, record, baseAttrs)
	if err != nil {
		log.Debug().Err(err).Msg("Could not record lunar transaction")
	}
	IncrementUserDefinedCounters(ctx, meter, record, baseAttrs)

	log.Debug().Msg("📀 Successfully updated Prometheus metrics")

	return nil
}

func RecordLunarTransaction(
	ctx context.Context,
	meter metric.Meter,
	record *diagnoses.MetricsCollectorRecord,
	baseAttrs []attribute.KeyValue,
) error {
	histogram, err := meter.Int64Histogram(
		lunarTransactionMetricName,
		instrument.WithDescription(
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
			attribute.Key(headerName).String(headerValue))
	}

	histogram.Record(ctx, record.DurationMillis, mainMetricAttrs...)

	return nil
}

func IncrementUserDefinedCounters(ctx context.Context,
	meter metric.Meter,
	record *diagnoses.MetricsCollectorRecord,
	baseAttrs []attribute.KeyValue,
) {
	for _, counterRecord := range record.Counters {
		log.Info().
			Msgf("Exporting defined-counter %s of value %d",
				counterRecord.Name, counterRecord.Increment)
		counter, err := meter.Int64Counter(counterRecord.Name)
		if err != nil {
			log.Debug().
				Err(err).
				Msgf("Failed to obtain user-defined counter %s"+
					"will not increment counter", counterRecord.Name)
			continue
		}

		counter.Add(ctx, counterRecord.Increment, baseAttrs...)
	}
}
