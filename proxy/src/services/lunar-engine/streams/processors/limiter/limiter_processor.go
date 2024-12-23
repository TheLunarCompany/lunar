package processorlimiter

import (
	"context"
	"fmt"
	"lunar/engine/streams/processors/utils"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	"lunar/toolkit-core/otel"

	lunar_metrics "lunar/engine/metrics"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/metric"
)

const (
	quotaIDArg              = "quota_id"
	belowQuotaConditionName = "below_limit"
	aboveQuotaConditionName = "above_limit"

	belowCountMetric = "lunar_limiter_processor_below_count"
	aboveCountMetric = "lunar_limiter_processor_above_count"
)

type limiterProcessor struct {
	name          string
	quotaID       string
	metaData      *streamtypes.ProcessorMetaData
	labelManager  *lunar_metrics.LabelManager
	metricObjects map[string]metric.Float64Counter
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	processor := &limiterProcessor{
		name:          metaData.Name,
		metaData:      metaData,
		metricObjects: make(map[string]metric.Float64Counter),
		labelManager:  lunar_metrics.NewLabelManager(metaData.GetMetricLabels()),
	}

	if err := utils.ExtractStrParam(metaData.Parameters,
		quotaIDArg,
		&processor.quotaID); err != nil {
		log.Trace().Msgf("quota_id not defined for %v", metaData.Name)
	}

	if _, err := metaData.Resources.GetQuota(processor.quotaID, ""); err != nil {
		return nil, fmt.Errorf(
			"quota %s not found for processor %s: %w",
			processor.quotaID,
			metaData.Name,
			err,
		)
	}

	if err := processor.initializeMetrics(); err != nil {
		log.Error().Err(err).Msgf("failed to initialize metrics for %s", metaData.Name)
		processor.metaData.Metrics.Enabled = false
	}

	return processor, nil
}

func (p *limiterProcessor) GetName() string {
	return p.name
}

func (p *limiterProcessor) Execute(
	flowName string,
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	if apiStream.GetType() != publictypes.StreamTypeRequest {
		return streamtypes.ProcessorIO{}, fmt.Errorf(
			"invalid stream type: %s",
			apiStream.GetType(),
		)
	}
	quota, err := p.metaData.Resources.GetQuota(p.quotaID, apiStream.GetID())
	if err != nil {
		return streamtypes.ProcessorIO{}, err
	}

	isAllowed, err := quota.Allowed(apiStream)
	if err != nil {
		return streamtypes.ProcessorIO{}, err
	}

	condition := aboveQuotaConditionName
	if isAllowed {
		condition = belowQuotaConditionName
	}

	p.updateMetrics(condition, flowName, apiStream)

	return streamtypes.ProcessorIO{
		Type: apiStream.GetType(),
		Name: condition,
	}, nil
}

func (p *limiterProcessor) initializeMetrics() error {
	log.Info().Msgf("Initializing metrics for %s", p.name)
	if !p.metaData.IsMetricsEnabled() {
		log.Info().Msgf("Metrics are disabled for %s", p.name)
		return nil
	}

	meter := otel.GetMeter()
	meterObj, err := meter.Float64Counter(belowCountMetric,
		metric.WithDescription(fmt.Sprintf("Limiter below count for %s", p.name)))
	if err != nil {
		return fmt.Errorf("failed to initialize below count metric: %w", err)
	}
	p.metricObjects[belowCountMetric] = meterObj

	meterObj, err = meter.Float64Counter(aboveCountMetric,
		metric.WithDescription(fmt.Sprintf("Limiter above count for %s", p.name)))
	if err != nil {
		return fmt.Errorf("failed to initialize above count metric: %w", err)
	}
	p.metricObjects[aboveCountMetric] = meterObj

	log.Info().Msgf("Metrics initialized for %s", p.name)
	return nil
}

func (p *limiterProcessor) updateMetrics(
	condition, flowName string,
	provider lunar_metrics.APICallMetricsProviderI,
) {
	if !p.metaData.IsMetricsEnabled() {
		return
	}

	attributes := p.labelManager.GetProcessorMetricsAttributes(provider, flowName, p.name)

	updateMetricFunc := func(metricName string) {
		if metricObj, ok := p.metricObjects[metricName]; ok {
			metricObj.Add(context.Background(), 1, metric.WithAttributes(attributes...))
		}
	}
	metricName := belowCountMetric
	if condition == aboveQuotaConditionName {
		metricName = aboveCountMetric
	}
	updateMetricFunc(metricName)

	log.Trace().Msgf("Metrics updated for %s", p.name)
}
