package writecache

import (
	"context"
	"fmt"
	"lunar/engine/actions"
	lunar_metrics "lunar/engine/metrics"
	lunar_context "lunar/engine/streams/lunar-context"
	"lunar/engine/streams/processors/utils"
	public_types "lunar/engine/streams/public-types"
	"lunar/toolkit-core/otel"
	"time"

	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/metric"
)

const (
	ttlParam             = "ttl_seconds"
	recordMaxSizeParam   = "record_max_size_bytes"
	maxCacheSizeParam    = "max_cache_size_mb"
	cachingKeyPartsParam = "caching_key_parts"

	usedCacheSizeKey = "used_cache_size"

	cacheSizeMetric           = lunar_metrics.MetricPrefix + "write_cache_processor_cache_size_written"
	cacheEntriesWrittenMetric = lunar_metrics.MetricPrefix + "write_cache_processor_cache_entries_written" //nolint:lll
)

type writeCacheProcessor struct {
	name string

	ttlSeconds            int64
	recordMaxSizeBytes    int
	maxCacheSizeMb        int
	cachingKeyDefinitions []string

	usedCacheSizeKeySuffix string
	usedCacheSize          public_types.SharedStateI[int64]
	cachedResponses        public_types.SharedStateI[[]byte]
	expiredCollector       *lunar_context.ExpireWatcher[[]byte]

	metaData     *streamtypes.ProcessorMetaData
	labelManager *lunar_metrics.LabelManager

	metricObjects map[string]metric.Int64Counter
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	proc := &writeCacheProcessor{
		name:                   metaData.Name,
		metaData:               metaData,
		metricObjects:          make(map[string]metric.Int64Counter),
		usedCacheSizeKeySuffix: fmt.Sprintf("%s_%s", metaData.Name, usedCacheSizeKey),
		usedCacheSize:          lunar_context.NewSharedState[int64](),
		cachedResponses:        lunar_context.NewSharedState[[]byte](),
		labelManager:           lunar_metrics.NewLabelManager(metaData.GetMetricLabels()),
	}

	proc.expiredCollector = lunar_context.GetExpireWatcher(proc.cachedResponses.Pop)

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

func (p *writeCacheProcessor) GetName() string {
	return p.name
}

func (p *writeCacheProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{
		IsBodyRequired: true,
	}
}

func (p *writeCacheProcessor) Execute(
	flowName string,
	apiStream public_types.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	if apiStream.GetType() != public_types.StreamTypeResponse {
		return streamtypes.ProcessorIO{}, fmt.Errorf("invalid stream type: %s", apiStream.GetType())
	}

	cacheKey, err := utils.BuildSharedMemoryKey(flowName,
		p.cachingKeyDefinitions,
		apiStream)
	if err != nil {
		log.Trace().Err(err).Msgf("Failed to build cache key for %s", p.name)
		return streamtypes.ProcessorIO{
			Type:      apiStream.GetType(),
			ReqAction: &actions.NoOpAction{},
			Failure:   true,
		}, nil
	}

	response := apiStream.GetResponse()
	if response == nil {
		return streamtypes.ProcessorIO{}, fmt.Errorf("response not found")
	}
	cacheEntry, err := utils.BuildSharedMemoryTTLEntry(p.ttlSeconds, response)
	if err != nil {
		log.Error().Err(err).Msgf("Failed to build cache record for %s", p.name)
		return streamtypes.ProcessorIO{}, err
	}

	cacheEntrySize := len(cacheEntry)

	currentCacheSize, canProceed := p.ensureCacheEntrySize(cacheEntrySize, flowName)
	if !canProceed {
		return streamtypes.ProcessorIO{
			Type:      apiStream.GetType(),
			ReqAction: &actions.NoOpAction{},
			Failure:   true,
		}, nil
	}

	err = p.cachedResponses.Set(cacheKey, cacheEntry)
	if err != nil {
		log.Error().Err(err).Msgf("Failed to set cache entry for %s", p.name)
		return streamtypes.ProcessorIO{}, err
	}
	p.expiredCollector.AddKey(cacheKey, time.Second*time.Duration(p.ttlSeconds))

	p.updateMetrics(flowName, apiStream, cacheEntrySize)
	p.updateCacheSize(flowName, currentCacheSize+int64(cacheEntrySize))

	return streamtypes.ProcessorIO{
		Type:      apiStream.GetType(),
		ReqAction: &actions.NoOpAction{},
	}, nil
}

func (p *writeCacheProcessor) init() error {
	if err := utils.ExtractListOfStringParam(p.metaData.Parameters,
		cachingKeyPartsParam,
		&p.cachingKeyDefinitions); err != nil {
		log.Error().Err(err).Msgf("Missing %s parameter", cachingKeyPartsParam)
		return err
	}

	if len(p.cachingKeyDefinitions) == 0 {
		return fmt.Errorf("%v cannot be empty", cachingKeyPartsParam)
	}

	if err := utils.ExtractInt64Param(p.metaData.Parameters,
		ttlParam,
		&p.ttlSeconds); err != nil {
		log.Error().Err(err).Msgf("Missing %s parameter", ttlParam)
		return err
	}

	if err := utils.ExtractIntParam(p.metaData.Parameters,
		recordMaxSizeParam,
		&p.recordMaxSizeBytes); err != nil {
		log.Error().Err(err).Msgf("Missing %s parameter", recordMaxSizeParam)
		return err
	}

	if err := utils.ExtractIntParam(p.metaData.Parameters,
		maxCacheSizeParam,
		&p.maxCacheSizeMb); err != nil {
		log.Error().Err(err).Msgf("Missing %s parameter", maxCacheSizeParam)
		return err
	}

	return nil
}

func (p *writeCacheProcessor) initializeMetrics() error {
	log.Info().Msgf("Initializing metrics for %s", p.name)
	if !p.metaData.IsMetricsEnabled() {
		log.Info().Msgf("Metrics are disabled for %s", p.name)
		return nil
	}

	meter := otel.GetMeter()
	meterObj, err := meter.Int64Counter(
		cacheSizeMetric,
		metric.WithUnit("By"), // unit for bytes
		metric.WithDescription("Cache size written by processor in bytes"))
	if err != nil {
		return fmt.Errorf("failed to initialize metric: %w", err)
	}
	p.metricObjects[cacheSizeMetric] = meterObj

	meterObj, err = meter.Int64Counter(
		cacheEntriesWrittenMetric,
		metric.WithDescription("Cache entries written by processor"))
	if err != nil {
		return fmt.Errorf("failed to initialize metric: %w", err)
	}
	p.metricObjects[cacheEntriesWrittenMetric] = meterObj

	log.Info().Msgf("Metrics initialized for %s", p.name)
	return nil
}

func (p *writeCacheProcessor) updateMetrics(
	flowName string,
	provider lunar_metrics.APICallMetricsProviderI,
	cacheEntrySize int,
) {
	if !p.metaData.IsMetricsEnabled() {
		return
	}

	attributes := p.labelManager.GetProcessorMetricsAttributes(provider, flowName, p.name)
	preparedAttributes := metric.WithAttributes(attributes...)

	ctx := context.Background()
	p.metricObjects[cacheSizeMetric].Add(ctx, int64(cacheEntrySize), preparedAttributes)
	p.metricObjects[cacheEntriesWrittenMetric].Add(ctx, 1, preparedAttributes)

	log.Trace().Msgf("Metrics updated for %s", p.name)
}

// ensureCacheEntrySize checks if the cache entry size is within the limits
// and returns the current cache size and if the entry can be stored
func (p *writeCacheProcessor) ensureCacheEntrySize(entrySize int, flowName string) (int64, bool) {
	currentCacheSize := p.getCurrentCacheSize(flowName)
	newCacheSizeMb := (currentCacheSize + int64(entrySize)) / (1024 * 1024)
	if newCacheSizeMb > int64(p.maxCacheSizeMb) {
		log.Warn().Msgf("cache size exceeded. New size: %v, max size: %v. Response won't be stored",
			newCacheSizeMb, p.maxCacheSizeMb)
		return 0, false
	}

	if p.recordMaxSizeBytes != -1 && entrySize > p.recordMaxSizeBytes {
		log.Warn().Msgf("response size %v exceeds the max allowed size %v. Response won't be stored",
			entrySize,
			p.recordMaxSizeBytes,
		)
		return 0, false
	}

	return currentCacheSize, true
}

// getCurrentCacheSize returns the current cache size allocated by this processor
func (p *writeCacheProcessor) getCurrentCacheSize(flowName string) int64 {
	// err here ignore since it means this is first time call
	size, _ := p.usedCacheSize.Get(p.buildCacheSizeKey(flowName))
	return size
}

// updateCacheSize updates the cache size allocated by this processor
func (p *writeCacheProcessor) updateCacheSize(flowName string, size int64) {
	if err := p.usedCacheSize.Set(p.buildCacheSizeKey(flowName), size); err != nil {
		log.Error().Err(err).Msgf("Failed to set cache size for %s", p.name)
	}
}

// buildCacheSizeKey builds the key for the cache size
func (p *writeCacheProcessor) buildCacheSizeKey(flowName string) string {
	return fmt.Sprintf("%s_%s", flowName, p.usedCacheSizeKeySuffix)
}
