package readcache

import (
	"context"
	"encoding/json"
	"fmt"
	"lunar/engine/actions"
	lunar_messages "lunar/engine/messages"
	lunar_metrics "lunar/engine/metrics"
	lunar_context "lunar/engine/streams/lunar-context"
	"lunar/engine/streams/processors/utils"
	public_types "lunar/engine/streams/public-types"
	"lunar/toolkit-core/otel"

	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/metric"
)

const (
	cachingKeyPartsParam = "caching_key_parts"

	hitConditionName  = "cache_hit"
	missConditionName = "cache_miss"

	cacheMissMetric       = lunar_metrics.MetricPrefix + "read_cache_processor_cache_miss"
	cacheHitMetric        = lunar_metrics.MetricPrefix + "read_cache_processor_cache_hit"
	cacheSizeServedMetric = lunar_metrics.MetricPrefix + "read_cache_processor_cache_size_served"
)

type readCacheProcessor struct {
	name                  string
	cachingKeyDefinitions []string

	cachedResponses public_types.SharedStateI[[]byte]

	metaData     *streamtypes.ProcessorMetaData
	labelManager *lunar_metrics.LabelManager

	metricObjects map[string]metric.Int64Counter
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	proc := &readCacheProcessor{
		name:            metaData.Name,
		metaData:        metaData,
		metricObjects:   make(map[string]metric.Int64Counter),
		cachedResponses: lunar_context.NewSharedState[[]byte](),
		labelManager:    lunar_metrics.NewLabelManager(metaData.GetMetricLabels()),
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

func (p *readCacheProcessor) GetName() string {
	return p.name
}

func (p *readCacheProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{
		IsBodyRequired: true,
	}
}

func (p *readCacheProcessor) Execute(
	flowName string,
	apiStream public_types.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	if apiStream.GetType() == public_types.StreamTypeRequest {
		return p.onRequest(flowName, apiStream)
	} else if apiStream.GetType() == public_types.StreamTypeResponse {
		return streamtypes.ProcessorIO{
			Type:       public_types.StreamTypeResponse,
			RespAction: &actions.NoOpAction{},
			Name:       "",
		}, nil
	}
	return streamtypes.ProcessorIO{}, fmt.Errorf("invalid stream type: %s", apiStream.GetType())
}

func (p *readCacheProcessor) init() error {
	if err := utils.ExtractListOfStringParam(p.metaData.Parameters,
		cachingKeyPartsParam,
		&p.cachingKeyDefinitions); err != nil {
		log.Error().Err(err).Msgf("Missing %s parameter", cachingKeyPartsParam)
		return err
	}

	if len(p.cachingKeyDefinitions) == 0 {
		return fmt.Errorf("%v cannot be empty", cachingKeyPartsParam)
	}
	return nil
}

func (p *readCacheProcessor) initializeMetrics() error {
	log.Info().Msgf("Initializing metrics for %s", p.name)
	if !p.metaData.IsMetricsEnabled() {
		log.Info().Msgf("Metrics are disabled for %s", p.name)
		return nil
	}

	meter := otel.GetMeter()
	meterObj, err := meter.Int64Counter(
		cacheMissMetric,
		metric.WithDescription("Cache misses by processor"))
	if err != nil {
		return fmt.Errorf("failed to initialize metric: %w", err)
	}
	p.metricObjects[cacheMissMetric] = meterObj

	meterObj, err = meter.Int64Counter(
		cacheHitMetric,
		metric.WithDescription("Cache hits by processor"))
	if err != nil {
		return fmt.Errorf("failed to initialize metric: %w", err)
	}
	p.metricObjects[cacheHitMetric] = meterObj

	meterObj, err = meter.Int64Counter(
		cacheSizeServedMetric,
		metric.WithUnit("By"), // unit for bytes
		metric.WithDescription("Cache size served by processor in bytes"))
	if err != nil {
		return fmt.Errorf("failed to initialize metric: %w", err)
	}
	p.metricObjects[cacheSizeServedMetric] = meterObj

	log.Info().Msgf("Metrics initialized for %s", p.name)
	return nil
}

func (p *readCacheProcessor) updateMetrics(
	flowName string,
	provider lunar_metrics.APICallMetricsProviderI,
	cacheServedSize int,
	cacheMiss bool,
) {
	if !p.metaData.IsMetricsEnabled() {
		return
	}

	attributes := p.labelManager.GetProcessorMetricsAttributes(provider, flowName, p.name)
	preparedAttributes := metric.WithAttributes(attributes...)

	ctx := context.Background()
	if cacheServedSize > 0 {
		p.metricObjects[cacheSizeServedMetric].Add(ctx, int64(cacheServedSize), preparedAttributes)
	}

	metricObjID := cacheHitMetric
	if cacheMiss {
		metricObjID = cacheMissMetric
	}
	p.metricObjects[metricObjID].Add(ctx, 1, preparedAttributes)

	log.Trace().Msgf("Metrics updated for %s", p.name)
}

func (p *readCacheProcessor) onRequest(
	flowName string,
	apiStream public_types.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	cacheKey, err := utils.BuildSharedMemoryKey(flowName,
		p.cachingKeyDefinitions,
		apiStream)
	if err != nil {
		log.Trace().Err(err).Msgf("Failed to build cache key for %s", p.name)
	}

	var cacheSizeServed int
	var onResponse *lunar_messages.OnResponse
	onResponse, cacheSizeServed, err = p.getCachedEntry(cacheKey)
	if err != nil {
		log.Error().Err(err).Msgf("Failed to get cached entry for key %s", cacheKey)
		return streamtypes.ProcessorIO{}, err
	}

	var reqAction actions.ReqLunarAction
	var reqType public_types.StreamType
	var conditionName string
	cacheMiss := onResponse == nil
	if cacheMiss {
		log.Trace().Msgf("Cache miss for key %s", cacheKey)
		reqType = public_types.StreamTypeRequest
		conditionName = missConditionName
		reqAction = &actions.NoOpAction{}
	} else {
		log.Trace().Msgf("Cache hit for key %s", cacheKey)
		reqType = public_types.StreamTypeResponse
		conditionName = hitConditionName
		reqAction = &actions.EarlyResponseAction{
			Status:  onResponse.Status,
			Body:    onResponse.Body,
			Headers: onResponse.Headers,
		}
	}

	p.updateMetrics(flowName, apiStream, cacheSizeServed, cacheMiss)

	return streamtypes.ProcessorIO{
		Type:      reqType,
		Name:      conditionName,
		ReqAction: reqAction,
	}, nil
}

// getCachedEntry retrieves a cached entry from the shared memory
func (p *readCacheProcessor) getCachedEntry(key string) (*lunar_messages.OnResponse, int, error) {
	storedBytes, _ := p.cachedResponses.Get(key)
	if len(storedBytes) == 0 {
		log.Trace().Msgf("Cache entry for key %s not found", key)
		return nil, 0, nil
	}

	ttlEntry, err := utils.ParseSharedMemoryTTLEntry(storedBytes)
	if err != nil {
		return nil, 0, err
	}

	if !ttlEntry.IsAlive() {
		log.Trace().Msgf("Cache entry for key %s is expired", key)
		return nil, 0, nil
	}
	var onResponse lunar_messages.OnResponse
	err = json.Unmarshal(ttlEntry.Content, &onResponse)
	if err != nil {
		return nil, 0, err
	}
	return &onResponse, len(ttlEntry.Content), nil
}
