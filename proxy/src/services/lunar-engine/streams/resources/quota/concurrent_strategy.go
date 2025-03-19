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
	"lunar/toolkit-core/interfaces"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var _ public_types.QuotaResourceI = &concurrentStrategy{}

const (
	timeDeltaForDeadRequestDecision        = 10 * time.Millisecond
	ConcurrentStrategyResetIntervalDefault = 600
	queueKeySuffix                         = "concurrent"
	memberDelimiter                        = "::"
	validMemberKeyParts                    = 3
)

type parsedMember struct {
	Found      bool
	InstanceID string
	ReqID      string
	ExpiryTime time.Duration
	Key        string
}

type allowedReqStatus struct {
	status incResult
	member string
}

type concurrentStrategy struct {
	quotaID         string
	parent          *resource_utils.QuotaNode[ResourceAdmI]
	logger          zerolog.Logger
	maxRequestCount int64
	filter          *stream_config.Filter
	systemFlowData  *resource_types.ResourceFlowData

	concurrentSetKey string
	sharedContext    public_types.SharedStateI[int64]
	mutex            sync.RWMutex
	allowedReq       map[string]*allowedReqStatus
	strategyConfig   *StrategyConfig

	requestExpireTime time.Duration
	gcInterval        time.Duration
	clusterLiveness   interfaces.ClusterLivenessI
}

func NewConcurrentStrategy(
	providerCfg *QuotaConfig,
	parent *resource_utils.QuotaNode[ResourceAdmI],
) (ResourceAdmI, error) {
	concurrentStrategy := &concurrentStrategy{
		parent:  parent,
		quotaID: providerCfg.ID,
		filter:  providerCfg.Filter,
		logger: log.Logger.With().Str("component", "concurrent").
			Str("ID", providerCfg.ID).Logger(),
		maxRequestCount:   providerCfg.Strategy.Concurrent.MaxRequestCount,
		concurrentSetKey:  fmt.Sprintf("%s_%s", providerCfg.ID, queueKeySuffix),
		sharedContext:     lunar_context.NewSharedState[int64](),
		allowedReq:        make(map[string]*allowedReqStatus),
		strategyConfig:    providerCfg.Strategy,
		requestExpireTime: providerCfg.Strategy.Concurrent.GetRequestExpiration(),
		gcInterval:        providerCfg.Strategy.Concurrent.GetGCInterval(),
	}

	if err := concurrentStrategy.init(); err != nil {
		return nil, fmt.Errorf("failed to initialize concurrent strategy: %w", err)
	}

	go concurrentStrategy.runGC()
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

func (cs *concurrentStrategy) Dec(APIStream public_types.APIStreamI) error {
	reqID := APIStream.GetID()
	cs.mutex.Lock()
	requestData, found := cs.allowedReq[reqID]
	cs.mutex.Unlock()

	if !found {
		return nil
	}

	if cs.checkReqStatus(reqID, reqAllowed) {
		err := cs.sharedContext.SRem(cs.concurrentSetKey, requestData.member)
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
	memberKey := cs.generateMember(reqID, cs.requestExpireTime)

	increased, err := cs.sharedContext.AtomicSAddWithMaxValuesAllowed(cs.concurrentSetKey,
		memberKey, cs.maxRequestCount)
	if err != nil {
		log.Debug().Err(err).Msg("Failed to increment")
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

	cs.mutex.Lock()
	cs.allowedReq[reqID].member = memberKey
	cs.mutex.Unlock()
	return nil
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

func (cs *concurrentStrategy) GetCounter() int64 {
	return cs.getCountFromContext(cs.concurrentSetKey)
}

func (cs *concurrentStrategy) getCountFromContext(key string) int64 {
	// We don't need to lock here as we are already in a mutex lock
	// (keep it in mind for future reference)
	count, err := cs.sharedContext.SCard(key)
	if err != nil {
		cs.logger.Trace().Err(err).Str("key", key).
			Msg("Failed to get count from context, initializing to 0")
		return 0
	}
	return count
}

func (cs *concurrentStrategy) init() error {
	cs.systemFlowData = &resource_types.ResourceFlowData{
		ID:                    cs.quotaID,
		Filter:                cs.filter,
		Processors:            cs.getProcessors(),
		ProcessorsConnections: cs.getProcessorsLocation(),
	}

	if cs.strategyConfig.Concurrent == nil {
		return fmt.Errorf("concurrent strategy config is nil")
	}

	clusterLiveness, exists := context_manager.Get().GetClusterLiveness()
	if !exists {
		cs.logger.Warn().Msg("Cluster liveness is not available")
	}

	cs.clusterLiveness = clusterLiveness
	return nil
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

func (cs *concurrentStrategy) setReqStatus(reqID string, reqStatus incResult) {
	cs.mutex.Lock()
	defer cs.mutex.Unlock()
	cs.allowedReq[reqID] = &allowedReqStatus{
		status: reqStatus,
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

func (cs *concurrentStrategy) generateMember(requestID string, ttl time.Duration) string {
	requestEnqueueTime := context_manager.Get().GetClock().Now()
	requestExpiryTime := requestEnqueueTime.Add(ttl + timeDeltaForDeadRequestDecision)

	instanceID := "unknown"
	if cs.clusterLiveness != nil {
		instanceID = cs.clusterLiveness.GetInstanceID()
	}

	return fmt.Sprintf(
		"%d%s%s%s%s",
		requestExpiryTime.UnixNano(),
		memberDelimiter,
		requestID,
		memberDelimiter,
		instanceID,
	)
}

func (cs *concurrentStrategy) runGC() {
	ctxMng := context_manager.Get()
	clock := ctxMng.GetClock()

	for {
		select {
		case <-ctxMng.GetContext().Done():
			return

		case <-clock.After(cs.gcInterval):
			cs.checkForExpiredRequests()
		}
	}
}

func (cs *concurrentStrategy) checkForExpiredRequests() {
	allowedRequests, err := cs.sharedContext.SMembers(cs.concurrentSetKey)
	if err != nil {
		cs.logger.Debug().Err(err).Msg("Failed to get allowed requests")
		return
	}

	for _, requestItem := range allowedRequests {
		parsedMember, err := cs.extractMemberFromItem(requestItem)
		if err != nil {
			cs.logger.Debug().Err(err).Msg("Failed to extract member from item")
			continue
		}

		isValid := cs.validateMemberIntegrity(parsedMember)
		if !isValid {
			log.Debug().Msgf("Member is not valid, removing from set: %s", requestItem)
		}
	}
}

func (cs *concurrentStrategy) extractMemberFromItem(item string) (*parsedMember, error) {
	parsedMember := &parsedMember{
		Key: item,
	}

	parts := strings.Split(item, memberDelimiter)
	if len(parts) != validMemberKeyParts {
		log.Error().
			Msgf("invalid format, expected {enter_timestamp}%s{value}%s{expiry_timestamp}.",
				memberDelimiter, memberDelimiter)
		return parsedMember, fmt.Errorf("invalid format")
	}

	expiry := parts[0] // from .UnixNano() to time.Unix
	reqID := parts[1]
	instanceID := parts[2]
	// expiryTimestamp, err := strconv.ParseInt(expiry, 10, 64)
	expiryTimestamp, err := strconv.ParseInt(expiry, 10, 64)
	if err != nil {
		log.Error().Msgf("invalid expiry timestamp. Removing from queue")
		return parsedMember, err
	}
	log.Debug().Msgf("RequestExpirationSec: %d", cs.requestExpireTime)
	log.Debug().Msgf("Expiry timestamp: %d", expiryTimestamp)
	expiryTime := time.Unix(0, expiryTimestamp)
	log.Debug().Msgf("Expiry time: %s", expiryTime)
	parsedMember.ExpiryTime = context_manager.Get().GetClock().Until(expiryTime)
	log.Debug().Msgf("Parsed expiry time: %s", parsedMember.ExpiryTime)
	if parsedMember.ExpiryTime < 0 {
		parsedMember.ExpiryTime = 0
	}

	parsedMember.ReqID = reqID
	parsedMember.InstanceID = instanceID
	parsedMember.Found = true
	return parsedMember, nil
}

func (cs *concurrentStrategy) validateMemberIntegrity(member *parsedMember) bool {
	// In case the instanceID cannot be found, we consider the member as invalid
	// In case clusterLiveness is not available, we consider the member as valid (to retry later)
	instanceIDInCluster := true
	if cs.clusterLiveness != nil {
		instanceIDInCluster = cs.clusterLiveness.IsPartOfCluster(member.InstanceID)
	}

	if !instanceIDInCluster || member.ExpiryTime <= 0 {
		cs.logger.Debug().Msgf("InstanceID: %s, ExpiryTime: %s", member.InstanceID, member.ExpiryTime)
		// This is a critical step to prevent dead items from being stuck in the queue
		// This can happened if a request linked to a crashed proxy is stack as the next item.
		if err := cs.sharedContext.SRem(cs.concurrentSetKey, member.Key); err != nil {
			log.Debug().Err(err).Msg("Failed to remove key from set")
		}

		cs.mutex.Lock()
		delete(cs.allowedReq, member.ReqID)
		cs.mutex.Unlock()

		return false
	}

	return true
}
