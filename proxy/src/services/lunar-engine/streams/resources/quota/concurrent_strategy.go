package quotaresource

import (
	"fmt"
	streamConfig "lunar/engine/streams/config"
	lunarContext "lunar/engine/streams/lunar-context"
	publicTypes "lunar/engine/streams/public-types"
	resourceTypes "lunar/engine/streams/resources/types"
	resourceUtils "lunar/engine/streams/resources/utils"
	"lunar/engine/utils/environment"
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
	allowedReq      map[string]quotaCounterUsed
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
		allowedReq:      make(map[string]quotaCounterUsed),
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

func (cs *concurrentStrategy) GetQuotaGroupsCounters() map[string]int64 {
	return make(map[string]int64)
}

func (cs *concurrentStrategy) Allowed(APIStream publicTypes.APIStreamI) (bool, error) {
	cs.logger.Trace().Msg("Checking if allowed")
	err := cs.Inc(APIStream)
	if err != nil {
		return false, err
	}
	cs.mutex.RLock()
	defer cs.mutex.RUnlock()
	if cs.isReqIDAlreadyAllowed(APIStream.GetID()) {
		if cs.parent != nil {
			return cs.parent.GetQuota().Allowed(APIStream)
		}
		cs.logger.Trace().Msg("Allowed")
		return true, nil
	}
	cs.logger.Trace().Msg("Blocked")
	return false, nil
}

func (cs *concurrentStrategy) Dec(APIStream publicTypes.APIStreamI) error {
	cs.mutex.RLock()
	defer cs.mutex.RUnlock()
	reqID := APIStream.GetID()
	_, exists := cs.allowedReq[reqID]
	if !exists {
		return nil
	}
	err := cs.storeCountIntoContext(cs.getCountFromContext(cs.currentCountKey) - 1)
	if err != nil {
		return err
	}
	delete(cs.allowedReq, reqID)
	return nil
}

func (cs *concurrentStrategy) Inc(APIStream publicTypes.APIStreamI) error {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()
	reqID := APIStream.GetID()

	if cs.isReqIDAlreadyAllowed(reqID) {
		return nil
	}

	currentCount := cs.getCountFromContext(cs.currentCountKey) + 1

	if currentCount <= cs.maxRequestCount {
		cs.logger.Trace().
			Str("reqID", reqID).
			Msgf("Incrementing current count to: %d", currentCount)
		err := cs.storeCountIntoContext(currentCount)
		if err != nil {
			return err
		}
		cs.setReqIDAsAllowed(reqID, counter)
	}

	if cs.parent != nil {
		return cs.parent.GetQuota().Inc(APIStream)
	}
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
		cs.buildProcName() + "_inc": &streamConfig.Processor{
			Processor: quotaProcessorInc,
			// We need to set the key name as it wont be load by the default way.
			Key: cs.buildProcName() + "_inc",
			Parameters: []*publicTypes.KeyValue{
				{
					Key:   quotaParamKey,
					Value: cs.quotaID,
				},
			},
		},
		cs.buildProcName() + "_dec": &streamConfig.Processor{
			Processor: quotaProcessorDec,
			// We need to set the key name as it wont be load by the default way.
			Key: cs.buildProcName() + "_dec",
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
			Start: []string{cs.buildProcName() + "_inc"},
		},
		Response: &resourceTypes.ResourceProcessorLocation{
			End: []string{cs.buildProcName() + "_dec"},
		},
	}
}

func (cs *concurrentStrategy) buildProcName() string {
	return fmt.Sprintf("%s_%s", cs.quotaID, quotaProcessorInc)
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
	count, err := cs.sharedContext.Get(counterKey)
	if err != nil {
		cs.logger.Trace().Err(err).Str("key", counterKey).
			Msg("Failed to get count from context, initializing to 0")
		return 0
	}
	return count
}

func (cs *concurrentStrategy) GetCounter() int64 {
	cs.mutex.RLock()
	defer cs.mutex.RUnlock()
	return cs.getCountFromContext(cs.currentCountKey)
}

func (cs *concurrentStrategy) setReqIDAsAllowed(reqID string, useType quotaCounterUsed) {
	cs.logger.Trace().Str("reqID", reqID).Msg("Adding request ID to increased")
	cs.allowedReq[reqID] = useType
}

func (cs *concurrentStrategy) isReqIDAlreadyAllowed(reqID string) bool {
	counterType, found := cs.allowedReq[reqID]
	if !found || counterType == notUsed {
		return false
	}
	cs.logger.Trace().Str("reqID", reqID).Msg("Request ID was already allowed")
	return true
}

func (cs *concurrentStrategy) storeCountIntoContext(count int64) error {
	// We don't need to lock here as we are already in a mutex lock
	// (keep it in mind for future reference)
	cs.logger.Trace().Int64("count", count).Str("key", cs.currentCountKey).Msg("Storing count into context") //nolint:lll
	err := cs.sharedContext.Set(cs.currentCountKey, count)
	if err != nil {
		cs.logger.Warn().Err(err).Str("key", cs.currentCountKey).Msg("Failed to store count into context")
		return err
	}
	return nil
}
