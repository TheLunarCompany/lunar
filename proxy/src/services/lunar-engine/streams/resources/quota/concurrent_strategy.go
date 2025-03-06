package quotaresource

import (
	"fmt"
	streamConfig "lunar/engine/streams/config"
	lunarContext "lunar/engine/streams/lunar-context"
	publicTypes "lunar/engine/streams/public-types"
	resourceTypes "lunar/engine/streams/resources/types"
	resourceUtils "lunar/engine/streams/resources/utils"
	"lunar/engine/utils/environment"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var _ publicTypes.QuotaResourceI = &concurrentStrategy{}

const ConcurrentStrategyResetIntervalDefault = 600

type concurrentStrategy struct {
	quotaID         string
	parent          *resourceUtils.QuotaNode[ResourceAdmI]
	logger          zerolog.Logger
	maxRequestCount int64
	filter          *streamConfig.Filter
	systemFlowData  *resourceTypes.ResourceFlowData

	currentCountKey string
	sharedContext   publicTypes.SharedStateI[int64]
	mutex           sync.RWMutex
	allowedReq      map[string]incResult
	strategyConfig  *StrategyConfig
}

func NewConcurrentStrategy(
	providerCfg *QuotaConfig,
	parent *resourceUtils.QuotaNode[ResourceAdmI],
) (ResourceAdmI, error) {
	if providerCfg.Strategy.Concurrent == nil {
		return nil, fmt.Errorf("concurrent strategy config is nil")
	}

	concurrentStrategy := &concurrentStrategy{
		parent:  parent,
		quotaID: providerCfg.ID,
		filter:  providerCfg.Filter,
		logger: log.Logger.With().Str("component", "concurrent").
			Str("ID", providerCfg.ID).Logger(),
		maxRequestCount: providerCfg.Strategy.Concurrent.MaxRequestCount,
		currentCountKey: fmt.Sprintf("%s_%s", providerCfg.ID, "currentCount"),
		sharedContext:   lunarContext.NewSharedState[int64](),
		allowedReq:      make(map[string]incResult),
		strategyConfig:  providerCfg.Strategy,
	}

	if err := concurrentStrategy.init(); err != nil {
		return nil, fmt.Errorf("failed to initialize concurrent strategy: %w", err)
	}
	return concurrentStrategy, nil
}

func (cs *concurrentStrategy) GetGroupedBy() string {
	if cs.parent != nil {
		return cs.parent.GetQuota().GetGroupedBy()
	}

	// GetGroupedBy is required by the interface
	return ""
}

func (cs *concurrentStrategy) GetSystemFlow() *resourceTypes.ResourceFlowData {
	return cs.systemFlowData
}

func (cs *concurrentStrategy) GetParentID() string {
	if cs.parent == nil {
		return ""
	}
	return cs.parent.GetQuota().GetID()
}

func (cs *concurrentStrategy) GetStrategyConfig() *StrategyConfig {
	return cs.strategyConfig
}

func (cs *concurrentStrategy) GetQuotaGroupsCounters() map[string]int64 {
	return make(map[string]int64)
}

func (cs *concurrentStrategy) Allowed(APIStream publicTypes.APIStreamI) (bool, error) {
	cs.logger.Trace().Msg("Checking if allowed")

	if err := cs.Inc(APIStream); err != nil {
		return false, err
	}

	if !cs.checkReqStatus(APIStream.GetID(), reqAllowed) {
		cs.logger.Trace().Msg("Blocked")
		return false, nil
	}

	if cs.parent != nil {
		return cs.parent.GetQuota().Allowed(APIStream)
	}

	cs.logger.Trace().Msg("Allowed")
	return true, nil
}

func (cs *concurrentStrategy) Dec(APIStream publicTypes.APIStreamI) error {
	reqID := APIStream.GetID()
	if cs.checkReqStatus(reqID, reqAllowed) {
		err := cs.sharedContext.AtomicDecr(cs.currentCountKey)
		if err != nil {
			return err
		}
	}

	if cs.parent != nil {
		if err := cs.parent.GetQuota().Dec(APIStream); err != nil {
			return err
		}
	}

	cs.mutex.Lock()
	delete(cs.allowedReq, reqID)
	cs.mutex.Unlock()
	return nil
}

func (cs *concurrentStrategy) Inc(APIStream publicTypes.APIStreamI) error {
	reqID := APIStream.GetID()

	// Validates that the request is not already processed
	if !cs.checkReqStatus(reqID, reqNotFound) {
		return nil
	}

	increased, err := cs.sharedContext.AtomicIncr(cs.currentCountKey, cs.maxRequestCount)
	if err != nil {
		return err
	}

	if !increased {
		return nil
	}

	if cs.parent != nil {
		if err := cs.parent.GetQuota().Inc(APIStream); err != nil {
			return err
		}
	}

	cs.setReqStatus(reqID, reqAllowed)
	return nil
}

func (cs *concurrentStrategy) init() error {
	cs.systemFlowData = &resourceTypes.ResourceFlowData{
		ID:                    cs.quotaID,
		Filter:                cs.filter,
		Processors:            cs.getProcessors(),
		ProcessorsConnections: cs.getProcessorsLocation(),
	}

	return nil
}

func (cs *concurrentStrategy) getProcessors() map[string]publicTypes.ProcessorDataI {
	return map[string]publicTypes.ProcessorDataI{
		cs.buildProcName(quotaProcessorInc): &streamConfig.Processor{
			Processor: quotaProcessorInc,
			// We need to set the key name as it wont be load by the default way.
			Key: cs.buildProcName(quotaProcessorInc),
			Parameters: []*publicTypes.KeyValue{
				{
					Key:   quotaParamKey,
					Value: cs.quotaID,
				},
				{
					Key:   applyLogicParamKey,
					Value: true,
				},
			},
		},
		cs.buildProcName(quotaProcessorDec): &streamConfig.Processor{
			Processor: quotaProcessorDec,
			// We need to set the key name as it wont be load by the default way.
			Key: cs.buildProcName(quotaProcessorDec),
			Parameters: []*publicTypes.KeyValue{
				{
					Key:   quotaParamKey,
					Value: cs.quotaID,
				},
			},
		},
	}
}

func (cs *concurrentStrategy) getProcessorsLocation() *resourceTypes.ResourceFlow {
	return &resourceTypes.ResourceFlow{
		Request: &resourceTypes.ResourceProcessorLocation{
			Start: []string{cs.buildProcName(quotaProcessorInc)},
		},
		Response: &resourceTypes.ResourceProcessorLocation{
			End: []string{cs.buildProcName(quotaProcessorDec)},
		},
	}
}

func (cs *concurrentStrategy) buildProcName(processor string) string {
	return fmt.Sprintf("%s_%s", strings.ReplaceAll(cs.quotaID, ".", ""), processor)
}

func (cs *concurrentStrategy) ResetIn() time.Duration {
	concurrentStrategyResetInterval, err := environment.GetConcurrentStrategyResetInterval()
	if err != nil {
		concurrentStrategyResetInterval = ConcurrentStrategyResetIntervalDefault
	}
	return time.Duration(concurrentStrategyResetInterval) * time.Millisecond
}

func (cs *concurrentStrategy) GetID() string {
	return cs.quotaID
}

func (cs *concurrentStrategy) GetLimit() int64 {
	return cs.maxRequestCount
}

func (cs *concurrentStrategy) getCountFromContext(counterKey string) int64 {
	// We don't need to lock here as we are already in a mutex lock
	// (keep it in mind for future reference)
	count, err := cs.sharedContext.GetQuotaCounter(counterKey)
	if err != nil {
		cs.logger.Trace().Err(err).Str("key", counterKey).
			Msg("Failed to get count from context, initializing to 0")
		return 0
	}
	return count
}

func (cs *concurrentStrategy) GetCounter() int64 {
	return cs.getCountFromContext(cs.currentCountKey)
}

func (cs *concurrentStrategy) setReqStatus(reqID string, reqStatus incResult) {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()
	cs.allowedReq[reqID] = reqStatus
}

func (cs *concurrentStrategy) checkReqStatus(reqID string, expectedStatus ...incResult) bool {
	cs.mutex.RLock()
	defer cs.mutex.RUnlock()
	reqStatus, found := cs.allowedReq[reqID]

	for _, status := range expectedStatus {
		if (found && reqStatus == status) || (!found && status == reqNotFound) {
			return true
		}
	}
	return false
}
