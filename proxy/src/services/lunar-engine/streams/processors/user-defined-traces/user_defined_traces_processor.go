package userdefinedtraces

import (
	"context"
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/streams/processors/utils"
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils/environment"
	"strings"
	"sync"
	"time"

	"github.com/ohler55/ojg/jp"
	"github.com/rs/zerolog/log"

	public_types "lunar/engine/streams/public-types"

	"go.opentelemetry.io/contrib/propagators/b3"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.7.0"
	"go.opentelemetry.io/otel/trace"
)

const (
	exporterIDParam            = "trace_exporter_id"
	customTraceAttributesParam = "custom_trace_attributes"

	tempoGRPCEndpoint = "tempo:4317"
	tempoHTTPEndpoint = "tempo:4318"

	cleanPeriod = 15 * time.Second
	cleanTTL    = 30 * time.Second
)

type userDefinedProcessor struct {
	name                  string
	exporterID            string
	tracesEndpoint        string
	withInsecure          bool
	customTraceAttributes map[string]string

	tracer            trace.Tracer
	activeContexts    map[string]context.Context // request ID -> ctx with span
	contextTimestamps map[string]time.Time
	mu                sync.Mutex // protects activeContexts

	metaData *streamtypes.ProcessorMetaData
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	proc := &userDefinedProcessor{
		name:                  metaData.Name,
		metaData:              metaData,
		activeContexts:        make(map[string]context.Context),
		contextTimestamps:     make(map[string]time.Time),
		customTraceAttributes: make(map[string]string),
	}

	if err := proc.init(); err != nil {
		return nil, err
	}

	if err := proc.initTracer(); err != nil {
		log.Error().Err(err).Msg("Failed to initialize tracer")
		return nil, err
	}

	return proc, nil
}

func (p *userDefinedProcessor) GetName() string {
	return p.name
}

func (p *userDefinedProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{
		IsBodyRequired: true,
	}
}

func (p *userDefinedProcessor) Execute(
	_ string,
	apiStream public_types.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	var err error
	if apiStream.GetType() == public_types.StreamTypeRequest {
		err = p.onRequest(apiStream)
	} else {
		err = p.onResponse(apiStream)
	}
	var reqAction actions.ReqLunarAction
	if err != nil {
		log.Trace().Err(err).Msgf("failed to collect traces %v", apiStream.GetType())
		reqAction = &actions.NoOpAction{}
	} else {
		reqAction = &actions.ModifyHeadersAction{
			HeadersToSet: apiStream.GetHeaders(),
		}
		log.Trace().Msgf("updated headers for trace collector: %v", apiStream.GetHeaders())
	}

	return streamtypes.ProcessorIO{
		Type:       apiStream.GetType(),
		ReqAction:  reqAction,
		RespAction: &actions.NoOpAction{},
	}, nil
}

func (p *userDefinedProcessor) onRequest(apiStream public_types.APIStreamI) error {
	txnID := apiStream.GetID()
	req := apiStream.GetRequest()
	if req == nil {
		return fmt.Errorf("request is nil for transaction %s", txnID)
	}

	// 1. Extract trace context from incoming headers  into a Context.
	headers := req.GetHeaders() // returns a mutable map, safe to modify for trace header injection
	carrier := propagation.MapCarrier(headers)

	ctx := otel.GetTextMapPropagator().Extract(context.Background(), carrier)

	// logging the extracted trace context. can be remove later
	contextSpan := trace.SpanContextFromContext(ctx)
	log.Trace().
		Str("txnID", txnID).
		Str("extracted_traceID", contextSpan.TraceID().String()).
		Str("extracted_spanID", contextSpan.SpanID().String()).
		Bool("is_valid", contextSpan.IsValid()).
		Bool("is_remote", contextSpan.IsRemote()).
		Msg("Extracted span context from headers")

	// Now ctx contains any parent trace from `traceparent` or B3 headers if present
	// https://www.w3.org/TR/trace-context/#:~:text=,a%20trace%20by%20modifying%20the.
	// If no parent trace is found, a new root span will be created.
	// If a parent trace is found, this span will be a child of that trace.

	// 2. Start a new span for the outbound request (SpanKindClient) with method and URL in the name.
	method := req.GetMethod()
	url := req.GetURL()
	spanName := fmt.Sprintf("%s %s", method, url)
	ctx, span := p.tracer.Start(ctx, spanName, trace.WithSpanKind(trace.SpanKindClient))

	// Span started. If there was a parent trace context, span is a child; otherwise it's a new root
	log.Trace().
		Str("txnID", txnID).
		Str("traceID", span.SpanContext().TraceID().String()).
		Str("spanID", span.SpanContext().SpanID().String()).
		Bool("isRecording", span.IsRecording()).
		Msg("Starting trace span")

	// 3. Set standard HTTP attributes on the span
	span.SetAttributes(
		attribute.String("http.method", method),
		attribute.String("http.url", url),
	)

	// 4. Extract and set any custom attributes defined by the user for this trace.
	for key, val := range p.extractCustomAttributes(apiStream) {
		span.SetAttributes(attribute.String(key, val))
	}

	// 5. Inject the current span context into the outbound request headers for propagation.
	otel.GetTextMapPropagator().Inject(ctx, carrier)

	log.Trace().
		Str("traceparent", headers["traceparent"]).
		Str("b3", headers["b3"]).
		Msg("headers for trace propagation")

	// 6. Store context so it can be accessed in onResponse.
	p.mu.Lock()
	p.activeContexts[txnID] = ctx
	p.contextTimestamps[txnID] = time.Now()
	p.mu.Unlock()

	return nil
}

func (p *userDefinedProcessor) onResponse(apiStream public_types.APIStreamI) error {
	txnID := apiStream.GetID()
	resp := apiStream.GetResponse()
	if resp == nil {
		return fmt.Errorf("response is nil for transaction %s", txnID)
	}

	// 1. Get from context span associated with this transaction (started in onRequest).
	p.mu.Lock()
	ctx, found := p.activeContexts[txnID]
	if found {
		delete(p.activeContexts, txnID)
		delete(p.contextTimestamps, txnID)
	}
	p.mu.Unlock()

	if !found {
		return fmt.Errorf("no tracing context for transaction: %s", txnID)
	}

	span := trace.SpanFromContext(ctx)

	// 2. Add response attributes to the span (status code, latency).
	// Get start time from span:
	// ReadOnlySpan interface has method StartTime() time.Time
	// https://pkg.go.dev/go.opentelemetry.io/otel/sdk/trace#ReadOnlySpan
	startTime := span.(interface{ StartTime() time.Time }).StartTime()
	latency := resp.GetTime().Sub(startTime)

	// 3. Record status and latency
	statusCode := resp.GetStatus()
	span.SetAttributes(
		attribute.Int("http.status_code", statusCode),
		attribute.Int64("http.latency_ms", latency.Milliseconds()),
	)

	if statusCode >= 400 {
		span.SetStatus(codes.Error, fmt.Sprintf("HTTP %d", statusCode))
	} else {
		span.SetStatus(codes.Ok, "")
	}

	// 4. End the span to complete the trace.
	log.Trace().
		Str("txnID", txnID).
		Str("traceID", span.SpanContext().TraceID().String()).
		Str("spanID", span.SpanContext().SpanID().String()).
		Bool("isRecording", span.IsRecording()).
		Msg("Ending trace span")

	// Span is now finished and will be exported by the OTLP exporter
	span.End()

	return nil
}

func (p *userDefinedProcessor) extractCustomAttributes(
	apiStream public_types.APIStreamI,
) map[string]string {
	customAttributes := make(map[string]string)
	data, err := utils.ConvertStreamToDataMap(apiStream)
	if err != nil {
		log.Err(err).Msg("failed to convert stream to data map")
		return customAttributes
	}

	for key, path := range p.customTraceAttributes {
		if path == "" {
			continue
		}
		path = strings.Replace(path, ".body.", ".body_map.", 1)

		expr, err := jp.ParseString(path)
		if err != nil {
			log.Trace().Err(err).Msgf("failed to parse JSONPath: %s", path)
			continue
		}
		values := expr.Get(data)
		if len(values) > 0 {
			val := fmt.Sprintf("%v", values[0])
			customAttributes[key] = val
		}
	}
	log.Trace().Str("txnID", apiStream.GetID()).
		Msgf("Extracted custom attributes: %v", customAttributes)
	return customAttributes
}

func (p *userDefinedProcessor) init() error {
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
	if p.exporterID != gatewayConfig.TraceExporter.TraceExporterID {
		return fmt.Errorf("exporter ID %s not found in gateway config %s",
			p.exporterID, gatewayConfig.TraceExporter.TraceExporterID)
	}

	if gatewayConfig.TraceExporter.TracesEndpoint == "" {
		return fmt.Errorf("traces endpoint not found in gateway config")
	}

	parsedEndpoint, err := utils.ExtractDomainAndPath(gatewayConfig.TraceExporter.TracesEndpoint)
	if err != nil {
		return fmt.Errorf("failed to parse traces endpoint: %w", err)
	}

	p.tracesEndpoint = parsedEndpoint.GetHostAndPort()
	if p.tracesEndpoint == tempoHTTPEndpoint {
		log.Warn().Msg("Tempo HTTP endpoint not supported. Switching to gRPC endpoint instead.")
		p.tracesEndpoint = tempoGRPCEndpoint
	}
	p.withInsecure = parsedEndpoint.GetScheme() == "http"

	err = utils.ExtractMapOfStringParam(
		p.metaData.Parameters,
		customTraceAttributesParam,
		p.customTraceAttributes,
	)
	if err != nil || len(p.customTraceAttributes) == 0 {
		log.Trace().Msg("No custom trace attributes found")
	}

	p.startContextCleaner(cleanTTL, cleanPeriod) // Start a goroutine to clean up expired contexts

	return nil
}

func (p *userDefinedProcessor) initTracer() error {
	ctx := context.Background()

	options := []otlptracegrpc.Option{otlptracegrpc.WithEndpoint(p.tracesEndpoint)}
	if p.withInsecure {
		options = append(options, otlptracegrpc.WithInsecure())
	}
	// TODO: add support for TLS creds in the future versions
	// options = append(options, otlptracegrpc.WithTLSCredentials())

	// Set up an OTLP exporter
	exporter, err := otlptracegrpc.New(ctx, options...)
	if err != nil {
		return fmt.Errorf("failed to create OTLP exporter: %w", err)
	}

	// Define a resource to identify our processor
	res, err := resource.New(ctx, resource.WithAttributes(semconv.ServiceNameKey.String(p.name)))
	if err != nil {
		return fmt.Errorf("failed to create otel resource for trace processor: %w", err)
	}

	// Create a tracer provider
	traceProvider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)

	// Set global tracer provider and propagator
	p.tracer = traceProvider.Tracer(p.name) // keep local tracer

	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
		b3.New(),
	))

	return nil
}

// startContextCleaner starts a goroutine that cleans up expired contexts
// based on the TTL and interval provided.
// It checks the contextTimestamps map and removes any contexts that have
// exceeded the TTL. It also removes the corresponding entries from activeContexts.
func (p *userDefinedProcessor) startContextCleaner(ttl time.Duration, interval time.Duration) {
	log.Trace().Msgf("Started context cleaner with TTL %s and interval %s", ttl, interval)
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for range ticker.C {
			now := time.Now()
			p.mu.Lock()
			for txnID, ts := range p.contextTimestamps {
				if now.Sub(ts) > ttl {
					delete(p.contextTimestamps, txnID)
					delete(p.activeContexts, txnID)
					log.Debug().Str("txnID", txnID).Msg("Cleaned up expired context")
				}
			}
			p.mu.Unlock()
		}
	}()
}
