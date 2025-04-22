package processorretry

import (
	"context"
	"fmt"
	"lunar/engine/actions"
	lunar_metrics "lunar/engine/metrics"
	"lunar/engine/streams/processors/utils"
	public_types "lunar/engine/streams/public-types"
	stream_types "lunar/engine/streams/types"
	"lunar/engine/utils/environment"
	"lunar/toolkit-core/otel"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"go.opentelemetry.io/otel/metric"
)

const (
	attemptsKey           = "attempts"
	cooldownKey           = "cooldown_between_attempts_seconds"
	cooldownMultiplierKey = "cooldown_multiplier"
	maximumCooldownKey    = "maximum_cooldown_seconds"

	retryCountMetric       = "lunar_retry_processor_retry_count"
	failedRetryCountMetric = "lunar_retry_processor_failed_retry_count"

	maxTimeoutAllowed = 2147483 * time.Second
)

type retryProcessor struct {
	name               string
	attempts           int
	cooldown           time.Duration
	maximumCooldown    time.Duration
	cooldownMultiplier float64
	metaData           *stream_types.ProcessorMetaData
	logger             zerolog.Logger
	labelManager       *lunar_metrics.LabelManager
	metricObjects      map[string]metric.Float64Counter
}

func NewProcessor(metaData *stream_types.ProcessorMetaData) (stream_types.ProcessorI, error) {
	retryProc := &retryProcessor{
		name:          metaData.Name,
		metaData:      metaData,
		metricObjects: make(map[string]metric.Float64Counter),
		labelManager:  lunar_metrics.NewLabelManager(metaData.GetMetricLabels()),
	}

	if err := retryProc.init(); err != nil {
		return nil, err
	}

	if err := retryProc.initializeMetrics(); err != nil {
		log.Error().Err(err).Msgf("failed to initialize metrics for %s", metaData.Name)
		retryProc.metaData.Metrics.Enabled = false
	}

	return retryProc, nil
}

func (p *retryProcessor) Execute(
	flowName string,
	APIStream public_types.APIStreamI,
) (stream_types.ProcessorIO, error) {
	retryCounterKey := p.getCounterKey(APIStream.GetSequenceID())
	currentRetryCount := p.incrementRetryCount(retryCounterKey, APIStream)

	if currentRetryCount > p.attempts {
		p.removeCount(retryCounterKey, APIStream)
		p.logger.Trace().Msg("Max retry attempts reached, will not retry")
		p.updateMetrics(failedRetryCountMetric, flowName, APIStream)
		return stream_types.ProcessorIO{
			Type: public_types.StreamTypeRequest,
			Name: "failed",
		}, nil
	}

	cooldownDuration := p.getCooldownDuration(currentRetryCount)

	p.logger.Trace().Int("currentRetryCount", currentRetryCount).
		Dur("cooldown", cooldownDuration).Msg("waiting before retry")

	<-p.metaData.Clock.After(cooldownDuration)

	p.updateMetrics(retryCountMetric, flowName, APIStream)
	return stream_types.ProcessorIO{
		RespAction: &actions.RetryRequestAction{},
		Type:       public_types.StreamTypeRequest,
		Name:       "retry",
	}, nil
}

func (p *retryProcessor) GetName() string {
	return p.name
}

func (p *retryProcessor) GetRequirement() *stream_types.ProcessorRequirement {
	return &stream_types.ProcessorRequirement{
		IsReqCaptureRequired: true,
	}
}

func (p *retryProcessor) incrementRetryCount(
	counterKey string,
	APIStream public_types.APIStreamI,
) int {
	var currentRetryCount int
	flowContext := APIStream.GetContext().GetFlowContext()
	currentRetryCountRaw, err := flowContext.Get(counterKey)

	if err != nil {
		log.Trace().Err(err).Msg("Failed to get retry counter")
		currentRetryCount = 0
	} else {
		currentRetryCount = currentRetryCountRaw.(int)
	}

	updatedRetryCount := currentRetryCount + 1

	err = flowContext.Set(counterKey, updatedRetryCount)
	if err != nil {
		p.logger.Debug().Err(err).Msg("Failed to set retry counter")
	}

	return updatedRetryCount
}

func (p *retryProcessor) removeCount(
	counterKey string,
	APIStream public_types.APIStreamI,
) {
	flowContext := APIStream.GetContext().GetFlowContext()
	_, err := flowContext.Pop(counterKey)
	if err != nil {
		p.logger.Debug().Err(err).Msg("Failed to remove retry counter")
	}
}

func (p *retryProcessor) getCounterKey(reqID string) string {
	return fmt.Sprintf("%s::%s::%s", p.name, "retry_counter", reqID)
}

func (p *retryProcessor) getCooldownDuration(currentRetryCount int) time.Duration {
	cooldown := p.cooldown.Seconds() + (float64(currentRetryCount) * p.cooldownMultiplier)

	if p.maximumCooldown > 0 && cooldown > p.maximumCooldown.Seconds() {
		p.logger.Debug().
			Msgf("Cooldown duration is greater than maximum cooldown, using maximum cooldown")
		cooldown = p.maximumCooldown.Seconds()
	}

	return time.Duration(cooldown) * time.Second
}

func (p *retryProcessor) init() error {
	p.logger = log.Logger.With().
		Str("processor", "retryProcessor").
		Str("processorKey", p.name).Logger()

	if err := utils.ExtractIntParam(p.metaData.Parameters,
		attemptsKey, &p.attempts); err != nil {
		return err
	}

	if p.attempts < 1 {
		return fmt.Errorf("attempts should be greater than 0")
	}

	if err := utils.ExtractDurationInSecParam(p.metaData.Parameters,
		cooldownKey, &p.cooldown); err != nil {
		return err
	}

	if p.cooldown < 0 {
		return fmt.Errorf("cooldown should be greater than or equal to 0")
	}

	if err := utils.ExtractFloat64Param(p.metaData.Parameters,
		cooldownMultiplierKey, &p.cooldownMultiplier); err != nil {
		return err
	}

	if p.cooldownMultiplier < 0 {
		return fmt.Errorf("cooldownMultiplier should be greater than or equal to 0")
	}

	if err := utils.ExtractDurationInSecParam(p.metaData.Parameters,
		maximumCooldownKey, &p.maximumCooldown); err != nil {
		return err
	}

	if p.maximumCooldown < 0 {
		return fmt.Errorf("maximumCooldown should be greater than 0")
	} else if p.maximumCooldown > maxTimeoutAllowed {
		return fmt.Errorf("maximumCooldown should be less than %s", maxTimeoutAllowed)
	}

	configuredTimeout, err := environment.GetLuaRetryRequestTimeout()
	if err != nil {
		return err
	}

	// Verify that the cooldown duration for each attempt is less than the configured timeout
	// Take in consideration that each retry can wait for the duration of the following attempts
	var cooldown time.Duration
	for currentAttempt := 1; currentAttempt <= p.attempts; currentAttempt++ {
		cooldown = cooldown + p.getCooldownDuration(currentAttempt)
		log.Trace().
			Dur("cooldown", cooldown).
			Dur("configuredTimeout", configuredTimeout).
			Msgf("Cooldown duration for attempt %d", currentAttempt)
		if cooldown > configuredTimeout {
			if p.maximumCooldown == 0 || configuredTimeout < p.maximumCooldown {
				return fmt.Errorf(
					"cooldown duration for attempt %d is greater than configured timeout, modify the value of %s",
					currentAttempt, environment.LuaRetryRequestTimeoutSecEnvVar,
				)
			}
		}
	}

	return nil
}

func (p *retryProcessor) initializeMetrics() error {
	log.Info().Msgf("Initializing metrics for %s", p.name)
	if !p.metaData.IsMetricsEnabled() {
		log.Info().Msgf("Metrics are disabled for %s", p.name)
		return nil
	}

	meter := otel.GetMeter()
	meterObj, err := meter.Float64Counter(retryCountMetric,
		metric.WithDescription(fmt.Sprintf("Retry attempts count for %s", p.name)))
	if err != nil {
		return fmt.Errorf("failed to initialize attempts count metric: %w", err)
	}
	p.metricObjects[retryCountMetric] = meterObj

	meterObj, err = meter.Float64Counter(failedRetryCountMetric,
		metric.WithDescription(fmt.Sprintf("Retry failed retry count for %s", p.name)))
	if err != nil {
		return fmt.Errorf("failed to initialize failed retry count metric: %w", err)
	}
	p.metricObjects[failedRetryCountMetric] = meterObj

	log.Info().Msgf("Metrics initialized for %s", p.name)
	return nil
}

func (p *retryProcessor) updateMetrics(
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

	updateMetricFunc(condition)

	log.Trace().Msgf("Metrics updated for %s", p.name)
}
