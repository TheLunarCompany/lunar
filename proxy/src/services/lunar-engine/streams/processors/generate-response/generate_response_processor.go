package processorgenerateresponse

import (
	"context"
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/streams/processors/utils"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	"lunar/toolkit-core/otel"

	lunar_metrics "lunar/engine/metrics"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/metric"
)

const (
	statusParam = "status"
	bodyParam   = "body"

	metricName = "lunar_generated_response_count"
)

type generateResponseProcessor struct {
	name       string
	statusCode int
	body       string
	header     map[string]string
	metaData   *streamtypes.ProcessorMetaData

	labelManager *lunar_metrics.LabelManager
	metricObject metric.Float64Counter
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	proc := &generateResponseProcessor{
		name:         metaData.Name,
		metaData:     metaData,
		header:       make(map[string]string),
		labelManager: lunar_metrics.NewLabelManager(metaData.GetMetricLabels()),
	}

	// status code
	if err := utils.ExtractIntParam(metaData.Parameters,
		statusParam,
		&proc.statusCode); err != nil {
		log.Trace().Err(err).Msgf("status code not defined for %v", metaData.Name)
	}

	// body
	if err := utils.ExtractStrParam(metaData.Parameters,
		bodyParam,
		&proc.body); err != nil {
		log.Trace().Err(err).Msgf("body not defined for %v", metaData.Name)
	}

	// headers
	if err := utils.ExtractMapFromParams(metaData.Parameters,
		&proc.header,
		statusParam,
		bodyParam); err != nil {
		log.Trace().Err(err).Msgf("headers not defined for %v", metaData.Name)
	}

	if err := proc.initializeMetrics(); err != nil {
		log.Error().Err(err).Msgf("failed to initialize metrics for %s", metaData.Name)
		proc.metaData.Metrics.Enabled = false
	}

	return proc, nil
}

func (p *generateResponseProcessor) GetName() string {
	return p.name
}

func (p *generateResponseProcessor) Execute(
	flowName string,
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	if apiStream.GetType() == publictypes.StreamTypeRequest {
		return p.onRequest(flowName, apiStream)
	} else if apiStream.GetType() == publictypes.StreamTypeResponse {
		return p.onResponse(apiStream)
	}
	return streamtypes.ProcessorIO{}, fmt.Errorf("invalid stream type: %s", apiStream.GetType())
}

func (p *generateResponseProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{}
}

func (p *generateResponseProcessor) onRequest(
	flowName string,
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	var action actions.ReqLunarAction = &actions.EarlyResponseAction{
		Status:  p.statusCode,
		Body:    p.body,
		Headers: p.header,
	}

	p.updateMetrics(flowName, apiStream)

	return streamtypes.ProcessorIO{
		Type:      publictypes.StreamTypeResponse,
		ReqAction: action,
		Name:      "",
	}, nil
}

func (p *generateResponseProcessor) onResponse(
	_ publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	return streamtypes.ProcessorIO{
		Type:       publictypes.StreamTypeResponse,
		RespAction: &actions.NoOpAction{},
		Name:       "",
	}, nil
}

func (p *generateResponseProcessor) initializeMetrics() error {
	log.Info().Msgf("Initializing metrics for %s", p.name)
	if !p.metaData.IsMetricsEnabled() {
		log.Info().Msgf("Metrics are disabled for %s", p.name)
		return nil
	}

	meter := otel.GetMeter()
	meterObj, err := meter.Float64Counter(metricName,
		metric.WithDescription(fmt.Sprintf("Generated response count for %s", p.name)))
	if err != nil {
		return fmt.Errorf("failed to initialize below count metric: %w", err)
	}
	p.metricObject = meterObj

	log.Info().Msgf("Metrics initialized for %s", p.name)
	return nil
}

func (p *generateResponseProcessor) updateMetrics(
	flowName string,
	provider lunar_metrics.APICallMetricsProviderI,
) {
	if !p.metaData.IsMetricsEnabled() {
		return
	}

	attributes := p.labelManager.GetProcessorMetricsAttributes(provider, flowName, p.name)
	p.metricObject.Add(context.Background(), 1, metric.WithAttributes(attributes...))

	log.Trace().Msgf("Metrics updated for %s", p.name)
}
