package quotaresource

import (
	"fmt"
	stream_config "lunar/engine/streams/config"
	lunar_context "lunar/engine/streams/lunar-context"
	public_types "lunar/engine/streams/public-types"
	resource_types "lunar/engine/streams/resources/types"
	resource_utils "lunar/engine/streams/resources/utils"
	"lunar/engine/utils/environment"
	context_manager "lunar/toolkit-core/context-manager"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var _ public_types.QuotaResourceI = &concurrentStrategy{}

const ConcurrentStrategyResetIntervalDefault = 600

type allowedReqStatus struct {
	status       incResult
	waitingSince time.Time
}

type concurrentStrategy struct {
	quotaID         string
	parent          *resource_utils.QuotaNode[ResourceAdmI]
	logger          zerolog.Logger
	maxRequestCount int64
	filter          *stream_config.Filter
	systemFlowData  *resource_types.ResourceFlowData

	currentCountKey string
	sharedContext   public_types.SharedStateI[int64]
	mutex           sync.RWMutex
	allowedReq      map[string]*allowedReqStatus
	strategyConfig  *StrategyConfig

	requestExpireTime time.Duration
}

func NewConcurrentStrategy(
	providerCfg *QuotaConfig,
	parent *resource_utils.QuotaNode[ResourceAdmI],
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
		sharedContext:   lunar_context.NewSharedState[int64](),
		allowedReq:      make(map[string]*allowedReqStatus),
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

func (cs *concurrentStrategy) GetSystemFlow() *resource_types.ResourceFlowData {
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

func (cs *concurrentStrategy) Allowed(APIStream public_types.APIStreamI) (bool, error) {
	allowed, err := cs.allowed(APIStream)
	if err != nil {
		return false, err
	}
	if !allowed {
		cs.checkForExpiredRequests()
		allowed, err = cs.allowed(APIStream)
	}

	return allowed, err
}

func (cs *concurrentStrategy) Dec(APIStream public_types.APIStreamI) error {
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

func (cs *concurrentStrategy) Inc(APIStream public_types.APIStreamI) error {
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

func (cs *concurrentStrategy) allowed(APIStream public_types.APIStreamI) (bool, error) {
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

func (cs *concurrentStrategy) init() error {
	cs.systemFlowData = &resource_types.ResourceFlowData{
		ID:                    cs.quotaID,
		Filter:                cs.filter,
		Processors:            cs.getProcessors(),
		ProcessorsConnections: cs.getProcessorsLocation(),
	}
	cs.requestExpireTime = environment.GetConcurrentRequestExpirationInSec()
	return nil
}

func (cs *concurrentStrategy) checkForExpiredRequests() {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()

	clock := context_manager.Get().GetClock()

	for reqID, reqStatus := range cs.allowedReq {
		if clock.Since(reqStatus.waitingSince) <= cs.requestExpireTime {
			continue
		}
		cs.logger.Trace().Str("reqID", reqID).Msg("Request expired")
		if cs.checkReqStatusNoLock(reqID, reqAllowed) {
			err := cs.sharedContext.AtomicDecr(cs.currentCountKey)
			if err != nil {
				cs.logger.Warn().Err(err).Msg("Failed to decrement count")
			}
		}
	}
}

func (cs *concurrentStrategy) getProcessors() map[string]public_types.ProcessorDataI {
	return map[string]public_types.ProcessorDataI{
		cs.buildProcName(quotaProcessorInc): &stream_config.Processor{
			Processor: quotaProcessorInc,
			// We need to set the key name as it wont be load by the default way.
			Key: cs.buildProcName(quotaProcessorInc),
			Parameters: []*public_types.KeyValue{
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
		cs.buildProcName(quotaProcessorDec): &stream_config.Processor{
			Processor: quotaProcessorDec,
			// We need to set the key name as it wont be load by the default way.
			Key: cs.buildProcName(quotaProcessorDec),
			Parameters: []*public_types.KeyValue{
				{
					Key:   quotaParamKey,
					Value: cs.quotaID,
				},
			},
		},
	}
}

func (cs *concurrentStrategy) getProcessorsLocation() *resource_types.ResourceFlow {
	return &resource_types.ResourceFlow{
		Request: &resource_types.ResourceProcessorLocation{
			Start: []string{cs.buildProcName(quotaProcessorInc)},
		},
		Response: &resource_types.ResourceProcessorLocation{
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
	cs.allowedReq[reqID] = &allowedReqStatus{
		status:       reqStatus,
		waitingSince: time.Now(),
	}
}

func (cs *concurrentStrategy) checkReqStatus(reqID string, expectedStatus ...incResult) bool {
	cs.mutex.RLock()
	defer cs.mutex.RUnlock()
	return cs.checkReqStatusNoLock(reqID, expectedStatus...)
}

func (cs *concurrentStrategy) checkReqStatusNoLock(reqID string, expectedStatus ...incResult) bool {
	reqStatus, found := cs.allowedReq[reqID]

	for _, status := range expectedStatus {
		if (found && reqStatus.status == status) || (!found && status == reqNotFound) {
			return true
		}
	}
	return false
}
