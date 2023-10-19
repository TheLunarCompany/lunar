package otel

import (
	"context"
	"lunar/shared-model/config"
	"os"
	"time"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/prometheus"
	"go.opentelemetry.io/otel/propagation"
	sdkMetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	"go.opentelemetry.io/otel/trace"
	"google.golang.org/grpc"
)

const (
	prometheusHost        = "0.0.0.0:3000"
	metricsRoute          = "/metrics"
	meterName             = "lunar-proxy"
	lunarInstrumentPrefix = "lunar_*"
)

// These are the default bucket boundaries that will be used in histograms
// in case no explicit bucket boundaries were supplied via config
var defaultBucketBoundaries = []float64{
	100,
	200,
	500,
	750,
	1000,
	2000,
	5000,
	10000,
}

// Initializes an OTLP exporter, and configures the corresponding trace and
// metric providers.
func InitProvider(
	ctx context.Context,
	serviceName string,
	exportersConfig config.Exporters,
) func() {
	resource, err := resource.New(ctx,
		resource.WithFromEnv(),
		resource.WithProcess(),
		resource.WithTelemetrySDK(),
		resource.WithHost(),
		resource.WithAttributes(
			// the service name used to display traces in backends
			semconv.ServiceNameKey.String(serviceName),
		),
	)
	handleErr(err, "Failed to create resource")
	// The exporter embeds a default OpenTelemetry Reader and
	// implements prometheus.Collector, allowing it to be used as
	// both a Reader and Collector.
	exporter, err := prometheus.New()
	if err != nil {
		handleErr(err, "Failed to run exporter embeds")
	}

	view := buildLunarView(exportersConfig)
	meterProvider := sdkMetric.NewMeterProvider(
		sdkMetric.WithReader(exporter),
		sdkMetric.WithView(view),
	)
	setRealMeter(meterProvider.Meter(meterName))

	var tracerProvider sdktrace.TracerProvider
	otelAgentAddr, traceProviderEnabled := os.LookupEnv(
		"OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")

	if traceProviderEnabled {
		traceClient := otlptracegrpc.NewClient(
			otlptracegrpc.WithInsecure(),
			otlptracegrpc.WithEndpoint(otelAgentAddr),
			otlptracegrpc.WithDialOption(grpc.WithBlock()))

		traceExporter, err := otlptrace.New(ctx, traceClient)
		handleErr(err, "Failed to create the collector trace exporter")

		bsp := sdktrace.NewBatchSpanProcessor(traceExporter)
		tracerProvider := sdktrace.NewTracerProvider(
			sdktrace.WithSampler(sdktrace.AlwaysSample()),
			sdktrace.WithResource(resource),
			sdktrace.WithSpanProcessor(bsp),
		)

		// set global propagator to trace context (the default is no-op).
		otel.SetTextMapPropagator(propagation.
			NewCompositeTextMapPropagator(propagation.TraceContext{},
				propagation.Baggage{}))
		otel.SetTracerProvider(tracerProvider)
	}

	return func() {
		cxt, cancel := context.WithTimeout(ctx, time.Second)
		defer cancel()
		if traceProviderEnabled {
			if err := tracerProvider.Shutdown(cxt); err != nil {
				otel.Handle(err)
			}
		}

		// pushes any last exports to the receiver
		if err := meterProvider.Shutdown(cxt); err != nil {
			otel.Handle(err)
		}
	}
}

func handleErr(err error, message string) {
	if err != nil {
		log.Error().Err(err).Msg(message)
	}
}

// A dedicated view for Lunar instruments. A Lunar instrument starts
// with the prefix `lunar_`.
func buildLunarView(exportersConfig config.Exporters) sdkMetric.View {
	histogramBucketBoundaries := defaultBucketBoundaries
	if exportersConfig.Prometheus != nil &&
		len(exportersConfig.Prometheus.BucketBoundaries) > 0 {
		histogramBucketBoundaries = exportersConfig.Prometheus.BucketBoundaries
	}
	return sdkMetric.NewView(
		sdkMetric.Instrument{ //nolint:exhaustruct
			Kind: sdkMetric.InstrumentKindHistogram,
			Name: lunarInstrumentPrefix,
		},
		sdkMetric.Stream{ //nolint:exhaustruct
			Aggregation: sdkMetric.AggregationExplicitBucketHistogram{
				Boundaries: histogramBucketBoundaries,
				NoMinMax:   false,
			},
		},
	)
}

func Tracer(ctx context.Context, spanName string) (
	context.Context, trace.Span,
) {
	return otel.Tracer("lunar-engine").Start(ctx, spanName)
}
