package quotaresource

import (
	"fmt"
	streamConfig "lunar/engine/streams/config"
	lunarContext "lunar/engine/streams/lunar-context"
	publicTypes "lunar/engine/streams/public-types"
	resourceTypes "lunar/engine/streams/resources/types"
	resourceUtils "lunar/engine/streams/resources/utils"
	"lunar/engine/streams/stream"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/jsonpath"
	"strconv"
	"sync"
	"time"

	contextManager "lunar/toolkit-core/context-manager"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var _ ResourceAdmI = &fixedWindow{}

type quotaCounterUsed int

const (
	notUsed quotaCounterUsed = iota
	counter
	spillover
	defaultResetIn = 2 * time.Second
)

type incResult int

const (
	alreadyIncreased incResult = iota
	increased
	blocked
)

type ExtractInt64F = func(publicTypes.APIStreamI) (int64, error)

type quota struct {
	window            time.Duration
	windowStart       time.Time
	maxCount          int64
	maxSpillover      int64
	quotaKey          string
	currentCountKey   string
	spilloverCountKey string
	withSpillover     bool
	logger            zerolog.Logger
	context           publicTypes.SharedStateI[int64]
	mutex             sync.RWMutex
	clock             clock.Clock
	allowedByReqID    map[string]bool
	extractCountF     ExtractInt64F
}

func newQuota(
	window time.Duration,
	key string,
	logger zerolog.Logger,
	maxCount,
	maxSpillover int64,
	withSpillover bool,
	extractCountF ExtractInt64F,
	context publicTypes.SharedStateI[int64],
	clock clock.Clock,
) *quota {
	return &quota{
		window:            window,
		windowStart:       clock.Now().UTC(),
		maxCount:          maxCount,
		maxSpillover:      maxSpillover,
		withSpillover:     withSpillover,
		quotaKey:          key,
		currentCountKey:   fmt.Sprintf("%s_%s", key, "currentCount"),
		spilloverCountKey: fmt.Sprintf("%s_%s", key, "spilloverCount"),
		logger:            logger.With().Str("component", "quota").Str("key", key).Logger(),
		context:           context.WithClock(clock),
		allowedByReqID:    make(map[string]bool),
		extractCountF:     extractCountF,
		mutex:             sync.RWMutex{},
		clock:             clock,
	}
}

func (q *quota) GetCounter() int64 {
	q.mutex.RLock()
	defer q.mutex.RUnlock()

	return q.getCountFromContext(q.currentCountKey)
}

func (q *quota) Reset(_ bool) {
	// TODO: Implement spillover reset
	q.mutex.Lock()
	defer q.mutex.Unlock()
	q.logger.Trace().Msg("Resetting quota")
	err := q.context.AtomicWindowReset(q.currentCountKey, q.window)
	if err != nil {
		q.logger.Warn().Err(err).Msg("Failed to reset quota")
	}
	q.onWindowRestart()
}

func (q *quota) ResetIn() time.Duration {
	q.mutex.Lock()
	defer q.mutex.Unlock()
	resetIn, windowRestarted, err := q.context.AtomicWindowResetIn(q.currentCountKey, q.window)
	if err != nil {
		q.logger.Warn().Err(err).Msg("Failed to get reset in")
		return defaultResetIn
	}

	if windowRestarted {
		q.onWindowRestart()
	}

	return resetIn
}

func (q *quota) Inc(APIStream publicTypes.APIStreamI) incResult {
	q.mutex.Lock()
	defer q.mutex.Unlock()

	reqID := APIStream.GetID()

	if _, found := q.allowedByReqID[reqID]; found {
		return alreadyIncreased
	}

	q.allowedByReqID[reqID] = false
	var err error
	var currentCount int64
	var spilloverCount int64
	var windowRestarted bool
	var incrBy int64
	if q.withSpillover {
		spilloverCount = q.getCountFromContext(q.spilloverCountKey)
	}
	if spilloverCount > 0 {
		q.logger.Trace().Int64("spilloverCount", spilloverCount).Msg("Using spillover")
		spilloverUpdatedCount := spilloverCount - 1
		q.logger.Trace().Msgf("Decrementing spillover count to: %d", spilloverUpdatedCount)
		q.storeCountIntoContext(spilloverUpdatedCount, q.spilloverCountKey)
		q.allowedByReqID[reqID] = true
	} else {
		incrBy, err = q.extractCountF(APIStream)
		if err != nil {
			q.logger.Warn().Err(err).Msg("Failed to extract count")
			incrBy = 0
		}
		q.logger.Trace().Int64("incrBy", incrBy).Msg("Incrementing window")

		currentCount, windowRestarted, err = q.context.AtomicIncWindow(q.currentCountKey, incrBy,
			q.window, q.maxCount)
		log.Trace().Msgf("AtomicIncWindow result: %d, %v", currentCount, windowRestarted)
		if windowRestarted {
			q.onWindowRestart()
		}
		if err != nil {
			q.logger.Trace().Err(err).Msg("Failed to increment window")
		} else {
			q.allowedByReqID[reqID] = true
		}
		q.storeCountIntoContext(currentCount, q.currentCountKey)
	}
	if q.allowedByReqID[reqID] {
		return increased
	}
	return blocked
}

func (q *quota) Dec(APIStream publicTypes.APIStreamI) {
	q.mutex.Lock()
	defer q.mutex.Unlock()
	reqID := APIStream.GetID()
	delete(q.allowedByReqID, reqID)
}

func (q *quota) Allowed(APIStream publicTypes.APIStreamI) bool {
	q.mutex.Lock()
	defer q.mutex.Unlock()
	reqID := APIStream.GetID()
	value, found := q.allowedByReqID[reqID]
	if !found {
		return false
	}

	delete(q.allowedByReqID, reqID)
	return value
}

func (q *quota) getCountFromContext(counterKey string) int64 {
	// We don't need to lock here as we are already in a mutex lock
	// (keep it in mind for future reference)
	count, err := q.context.GetQuotaCounter(counterKey)
	if err != nil {
		q.logger.Trace().Err(err).Str("key", counterKey).
			Msg("Failed to get count from context, initializing to 0")
		return 0
	}
	return count
}

func (q *quota) storeCountIntoContext(count int64, key string) {
	// We don't need to lock here as we are already in a mutex lock
	// (keep it in mind for future reference)
	q.logger.Trace().Int64("count", count).Str("key", key).Msg("Storing count into context")
	err := q.context.Set(key, count)
	if err != nil {
		q.logger.Warn().
			Err(err).
			Str("key", q.currentCountKey).
			Msg("Failed to store count into context")
	}
}

func (q *quota) onWindowRestart() {
	// We don't need to lock here as we are already in a mutex lock
	q.allowedByReqID = make(map[string]bool)
}

type fixedWindow struct {
	quotaID          string
	parent           *resourceUtils.QuotaNode[ResourceAdmI]
	context          publicTypes.SharedStateI[int64]
	max              int64
	spilloverMax     int64
	groupByKey       string
	window           time.Duration
	monthlyRenewal   *MonthlyRenewalData
	nextMonthlyReset time.Time
	spilloverData    *Spillover
	filter           *streamConfig.Filter
	clock            clock.Clock
	logger           zerolog.Logger
	systemFlowData   *resourceTypes.ResourceFlowData
	quotaGroups      map[string]*quota
	getQuotaLock     sync.Mutex
	alignmentLock    sync.Mutex
	extractCountF    ExtractInt64F
}

func NewFixedStrategy(
	providerCfg *QuotaConfig,
	parent *resourceUtils.QuotaNode[ResourceAdmI],
) (ResourceAdmI, error) {
	var fixedWindow *fixedWindow
	if providerCfg.Strategy.FixedWindow != nil {
		fixedWindow = newTransactionalFixedWindow(providerCfg, parent)
	} else if providerCfg.Strategy.FixedWindowCustomCounter != nil {
		fixedWindow = newCustomCounterFixedWindow(providerCfg, parent)
	} else {
		return nil, fmt.Errorf("fixed window strategy config is nil")
	}

	if err := fixedWindow.init(); err != nil {
		return nil, fmt.Errorf("failed to initialize fixed window: %w", err)
	}
	return fixedWindow, nil
}

func newTransactionalFixedWindow(
	providerCfg *QuotaConfig,
	parent *resourceUtils.QuotaNode[ResourceAdmI],
) *fixedWindow {
	// Extract count function for transactional fixed window strategy is
	// always 1 - a private case of custom counters
	extractCountF := func(_ publicTypes.APIStreamI) (int64, error) {
		return int64(1), nil
	}
	instance := fixedWindow{
		parent:        parent,
		quotaID:       providerCfg.ID,
		filter:        providerCfg.Filter,
		max:           providerCfg.Strategy.FixedWindow.Max,
		window:        providerCfg.Strategy.FixedWindow.ParseWindow(),
		spilloverData: providerCfg.Strategy.FixedWindow.Spillover,
		groupByKey:    providerCfg.Strategy.FixedWindow.GetGroup(),
		clock:         contextManager.Get().GetClock(),
		logger: log.Logger.With().Str("component", "fixedWindow").
			Str("ID", providerCfg.ID).Logger(),
		context:       lunarContext.NewSharedState[int64](),
		quotaGroups:   make(map[string]*quota),
		extractCountF: extractCountF,
	}
	return &instance
}

func newCustomCounterFixedWindow(
	providerCfg *QuotaConfig,
	parent *resourceUtils.QuotaNode[ResourceAdmI],
) *fixedWindow {
	extractCountF := buildExtractCountFromCounterValuePath(
		providerCfg.Strategy.FixedWindowCustomCounter.CounterValuePath,
	)
	instance := fixedWindow{
		parent:        parent,
		quotaID:       providerCfg.ID,
		filter:        providerCfg.Filter,
		max:           providerCfg.Strategy.FixedWindowCustomCounter.Max,
		window:        providerCfg.Strategy.FixedWindowCustomCounter.ParseWindow(),
		spilloverData: providerCfg.Strategy.FixedWindowCustomCounter.Spillover,
		groupByKey:    providerCfg.Strategy.FixedWindowCustomCounter.GetGroup(),
		clock:         contextManager.Get().GetClock(),
		logger: log.Logger.With().Str("component", "fixedWindow").
			Str("ID", providerCfg.ID).Logger(),
		context:       lunarContext.NewSharedState[int64](),
		quotaGroups:   make(map[string]*quota),
		extractCountF: extractCountF,
	}
	return &instance
}

func buildExtractCountFromCounterValuePath(counterValuePath string) ExtractInt64F {
	return func(apiStream publicTypes.APIStreamI) (int64, error) {
		raw, err := jsonpath.GetJSONPathValueAsType[string](
			stream.AsObject(apiStream),
			counterValuePath,
		)
		if err != nil {
			return 0, fmt.Errorf("failed to get raw counter value: %w", err)
		}
		parsed, err := strconv.ParseInt(raw, 10, 64)
		if err != nil {
			return 0, fmt.Errorf("failed to parse raw counter value: %w", err)
		}
		return parsed, nil
	}
}

func (fw *fixedWindow) GetParentID() string {
	if fw.parent == nil {
		return ""
	}
	return fw.parent.GetQuota().GetID()
}

func (fw *fixedWindow) GetGroupedBy() string {
	if fw.parent != nil {
		return fw.parent.GetQuota().GetGroupedBy()
	}
	fw.logger.Trace().Str("group", fw.groupByKey).Msg("Getting group")
	return fw.groupByKey
}

func (fw *fixedWindow) GetSystemFlow() *resourceTypes.ResourceFlowData {
	return fw.systemFlowData
}

func (fw *fixedWindow) GetQuotaGroupsCounters() map[string]int64 {
	counters := make(map[string]int64)
	for key, quotaObj := range fw.quotaGroups {
		counters[key] = quotaObj.GetCounter()
	}
	return counters
}

func (fw *fixedWindow) Allowed(APIStream publicTypes.APIStreamI) (bool, error) {
	fw.windowAligning()
	fw.logger.Trace().Msg("Checking if allowed")
	quotaObj, err := fw.getQuota(APIStream)
	if err != nil {
		return false, err
	}

	if quotaObj.Allowed(APIStream) {
		if fw.parent != nil {
			return fw.parent.GetQuota().Allowed(APIStream)
		}
		fw.logger.Trace().Msg("Allowed")
		return true, nil
	}

	fw.logger.Trace().Msg("Blocked")
	return false, nil
}

func (fw *fixedWindow) Dec(APIStream publicTypes.APIStreamI) error {
	fw.windowAligning()
	quotaObj, err := fw.getQuota(APIStream)
	if err != nil {
		return err
	}
	quotaObj.Dec(APIStream)
	if fw.parent != nil {
		return fw.parent.GetQuota().Dec(APIStream)
	}
	return nil
}

func (fw *fixedWindow) Inc(APIStream publicTypes.APIStreamI) error {
	fw.windowAligning()
	quotaObj, err := fw.getQuota(APIStream)
	if err != nil {
		return err
	}

	isIncreased := quotaObj.Inc(APIStream)
	if isIncreased == increased && fw.parent != nil {
		return fw.parent.GetQuota().Inc(APIStream)
	}
	return nil
}

func (fw *fixedWindow) ResetIn() time.Duration {
	return fw.getNextResetIn()
}

func (fw *fixedWindow) windowAligning() {
	fw.alignmentLock.Lock()
	defer fw.alignmentLock.Unlock()
	if fw.aligningMonthlyReset() {
		return
	}
}

func (fw *fixedWindow) GetID() string {
	return fw.quotaID
}

func (fw *fixedWindow) GetLimit() int64 {
	return fw.max
}

func (fw *fixedWindow) getQuota(APIStream publicTypes.APIStreamI) (*quota, error) {
	fw.getQuotaLock.Lock()
	defer fw.getQuotaLock.Unlock()
	fw.logger.Trace().Msg("Getting quota")
	quotaKey := fw.calculateContextKey(APIStream)
	fw.logger.Trace().Str("quotaKey", quotaKey).Msg("Quota key calculated")

	value, found := fw.quotaGroups[quotaKey]
	if found {
		fw.logger.Trace().Str("quotaKey", quotaKey).
			Msg("Quota object found in context, returning")
		return value, nil
	}

	fw.logger.Trace().
		Str("quotaKey", quotaKey).
		Msg("Quota object not found in context, initialize new quota")

	quotaObj := newQuota(fw.window, quotaKey, fw.logger, fw.max, fw.spilloverMax,
		fw.spilloverData != nil, fw.extractCountF, fw.context, fw.clock)
	fw.quotaGroups[quotaKey] = quotaObj
	return quotaObj, nil
}

func (fw *fixedWindow) calculateContextKey(apiStream publicTypes.APIStreamI) string {
	var found bool
	groupByValue := DefaultGroup

	if fw.groupByKey != DefaultGroup {
		groupByValue, found = apiStream.GetHeader(fw.groupByKey)
		if !found {
			fw.logger.Debug().
				Str("group", fw.groupByKey).
				Msg("Failed to locate group header, using default")
			groupByValue = DefaultGroup
		}
	}

	return fmt.Sprintf("%s_%s", fw.quotaID, groupByValue)
}

func (fw *fixedWindow) init() error {
	fw.validateSpilloverNeeds()
	fw.systemFlowData = &resourceTypes.ResourceFlowData{
		ID:                    fw.quotaID,
		Filter:                fw.filter,
		Processors:            fw.getProcessors(),
		ProcessorsConnections: fw.getProcessorsLocation(),
	}

	if fw.monthlyRenewal != nil {
		nextMonthlyReset, err := fw.monthlyRenewal.getMonthlyResetIn()
		if err != nil {
			return fmt.Errorf("failed to get next monthly reset: %w", err)
		}
		fw.nextMonthlyReset = nextMonthlyReset
	}
	return nil
}

func (fw *fixedWindow) getProcessors() map[string]publicTypes.ProcessorDataI {
	return map[string]publicTypes.ProcessorDataI{
		fw.buildProcName(): &streamConfig.Processor{
			Processor: quotaProcessorInc,
			// We need to set the key name as it wont be load by the default way.
			Key: fw.buildProcName(),
			Parameters: []*publicTypes.KeyValue{
				{
					Key:   quotaParamKey,
					Value: fw.quotaID,
				},
				{
					Key:   applyLogicParamKey,
					Value: true,
				},
			},
		},
	}
}

func (fw *fixedWindow) getProcessorsLocation() *resourceTypes.ResourceFlow {
	return &resourceTypes.ResourceFlow{
		Request: &resourceTypes.ResourceProcessorLocation{
			Start: []string{fw.buildProcName()},
		},
	}
}

func (fw *fixedWindow) buildProcName() string {
	return fmt.Sprintf("%s_%s", fw.quotaID, quotaProcessorInc)
}

func (fw *fixedWindow) validateSpilloverNeeds() {
	if fw.spilloverData != nil {
		fw.spilloverMax = fw.spilloverData.Max
	}
}

func (fw *fixedWindow) aligningMonthlyReset() bool {
	if fw.monthlyRenewal == nil || fw.nextMonthlyReset.IsZero() {
		return false
	}

	shouldReset := fw.clock.Now().After(fw.nextMonthlyReset)
	if shouldReset {
		fw.resetQuota(true)

		nextMonthlyReset, err := fw.monthlyRenewal.getMonthlyResetIn()
		if err != nil {
			fw.logger.Warn().Err(err).
				Msg("Failed to get next monthly reset, please reconfigure the monthly renewal date.")
			fw.nextMonthlyReset = time.Time{}
		} else {
			fw.nextMonthlyReset = nextMonthlyReset
		}
	}
	return shouldReset
}

func (fw *fixedWindow) resetQuota(withSpillover bool) {
	fw.getQuotaLock.Lock()
	defer fw.getQuotaLock.Unlock()
	for quotaKey, quotaObj := range fw.quotaGroups {
		fw.logger.Trace().Str("quotaKey", quotaKey).Msg("Resetting quota")
		quotaObj.Reset(withSpillover)
	}
}

func (fw *fixedWindow) getNextResetIn() time.Duration {
	resetIn := defaultResetIn
	fw.getQuotaLock.Lock()
	defer fw.getQuotaLock.Unlock()

	for _, quotaObj := range fw.quotaGroups {
		quotaResetIn := quotaObj.ResetIn()
		if resetIn < quotaResetIn {
			resetIn = quotaResetIn
		}
	}
	return resetIn
}
