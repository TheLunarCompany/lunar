package countllmtokens

import (
	"context"
	"fmt"
	"lunar/engine/actions"
	lunar_metrics "lunar/engine/metrics"
	"lunar/engine/streams/processors/utils"
	public_types "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	"lunar/toolkit-core/ai"
	"lunar/toolkit-core/ai/models"
	"lunar/toolkit-core/otel"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const (
	StoreCountHeaderParam = "store_count_header"
	ModelTypeParam        = "model_type"
	ModelParam            = "model"
	EncodingParam         = "encoding"

	tokenCountMetric = "lunar_llm_tokens_count"
)

type countLLMTokensProcessor struct {
	name             string
	storeCountHeader string
	modelType        string
	model            string
	encoding         string

	tokenizer *ai.Tokenizer

	metaData     *streamtypes.ProcessorMetaData
	labelManager *lunar_metrics.LabelManager
	metricObject metric.Int64Counter
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	proc := &countLLMTokensProcessor{
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

func (p *countLLMTokensProcessor) GetName() string {
	return p.name
}

func (p *countLLMTokensProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{
		IsBodyRequired: true,
	}
}

func (p *countLLMTokensProcessor) Execute(
	flowName string,
	apiStream public_types.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	apiStreamBody := apiStream.GetBody()
	tokenCount, err := p.tokenizer.CountTokensOfText(apiStreamBody)
	if err != nil {
		return streamtypes.ProcessorIO{}, err
	}

	if p.storeCountHeader == "" {
		return streamtypes.ProcessorIO{}, fmt.Errorf("store_count_header not defined for %v", p.name)
	}

	apiStream.GetHeaders()[p.storeCountHeader] = fmt.Sprintf("%d", tokenCount)

	p.updateMetrics(flowName, apiStream, int64(tokenCount))

	return streamtypes.ProcessorIO{
		Type:      apiStream.GetType(),
		ReqAction: &actions.NoOpAction{},
	}, nil
}

func (p *countLLMTokensProcessor) init() error {
	if err := utils.ExtractStrParam(p.metaData.Parameters,
		StoreCountHeaderParam,
		&p.storeCountHeader); err != nil {
		log.Trace().Msgf("%v not defined for %v", StoreCountHeaderParam, p.name)
	}

	if err := utils.ExtractStrParam(p.metaData.Parameters,
		ModelParam,
		&p.model); err != nil {
		log.Trace().Msgf("%v not defined for %v", ModelParam, p.name)
	}

	if err := utils.ExtractStrParam(p.metaData.Parameters,
		ModelTypeParam,
		&p.modelType); err != nil {
		log.Trace().Msgf("%v not defined for %v", ModelTypeParam, p.name)
	}

	if err := utils.ExtractStrParam(p.metaData.Parameters,
		EncodingParam,
		&p.encoding); err != nil {
		log.Trace().Msgf("%v not defined for %v", EncodingParam, p.name)
	}

	if p.model == "" && p.modelType == "" && p.encoding == "" {
		log.Warn().Msgf("No model, model type or encoding defined for %v, using default encoding %v",
			p.name,
			models.ChatGPTDefaultEncoding)
		p.encoding = models.ChatGPTDefaultEncoding
	}

	var err error
	p.tokenizer, err = ai.NewTokenizer(p.model, p.modelType, p.encoding)
	if err != nil {
		return fmt.Errorf("failed to initialize tokenizer: %w", err)
	}

	return nil
}

func (p *countLLMTokensProcessor) initializeMetrics() error {
	log.Info().Msgf("Initializing metrics for %s", p.name)
	if !p.metaData.IsMetricsEnabled() {
		log.Info().Msgf("Metrics are disabled for %s", p.name)
		return nil
	}

	meter := otel.GetMeter()
	meterObj, err := meter.Int64Counter(tokenCountMetric,
		metric.WithDescription(fmt.Sprintf("Generated response count for %s", p.name)))
	if err != nil {
		return fmt.Errorf("failed to initialize below count metric: %w", err)
	}
	p.metricObject = meterObj

	log.Info().Msgf("Metrics initialized for %s", p.name)
	return nil
}

func (p *countLLMTokensProcessor) updateMetrics(
	flowName string,
	provider lunar_metrics.APICallMetricsProviderI,
	tokenCount int64,
) {
	if !p.metaData.IsMetricsEnabled() {
		return
	}

	attributes := p.labelManager.GetProcessorMetricsAttributes(provider, flowName, p.name)
	if p.model != "" {
		attributes = append(attributes, attribute.String("model", p.model))
	}
	if p.modelType != "" {
		attributes = append(attributes, attribute.String("model_type", p.modelType))
	}
	if p.encoding != "" {
		attributes = append(attributes, attribute.String("encoding", p.encoding))
	}

	p.metricObject.Add(context.Background(), tokenCount, metric.WithAttributes(attributes...))

	log.Trace().Msgf("Metrics updated for %s", p.name)
}
