package quotaresource

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	publictypes "lunar/engine/streams/public-types"
	resourcetypes "lunar/engine/streams/resources/types"
	resourceutils "lunar/engine/streams/resources/utils"
	streamtypes "lunar/engine/streams/types"
	"lunar/toolkit-core/clock"
	contextmanager "lunar/toolkit-core/context-manager"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var _ ResourceAdmI = &fixedWindow{}

var epochTime = time.Unix(0, 0)

type quotaCounterUsed int

const (
	notUsed quotaCounterUsed = iota
	counter
	spillover
)

type quota struct {
	maxCount          int64
	maxSpillover      int64
	quotaKey          string
	currentCountKey   string
	spilloverCountKey string
	withSpillover     bool
	logger            zerolog.Logger
	context           publictypes.SharedStateI[int64]
	mutex             sync.RWMutex
	allowedReq        map[string]quotaCounterUsed
}

func newQuota(
	key string,
	logger zerolog.Logger,
	maxCount,
	maxSpillover int64,
	withSpillover bool,
) *quota {
	return &quota{
		maxCount:          maxCount,
		maxSpillover:      maxSpillover,
		withSpillover:     withSpillover,
		quotaKey:          key,
		currentCountKey:   fmt.Sprintf("%s_%s", key, "currentCount"),
		spilloverCountKey: fmt.Sprintf("%s_%s", key, "spilloverCount"),
		logger:            logger.With().Str("component", "quota").Str("key", key).Logger(),
		context:           streamtypes.NewSharedState[int64](),
		allowedReq:        make(map[string]quotaCounterUsed),
	}
}

func (q *quota) GetCounter() int64 {
	q.mutex.RLock()
	defer q.mutex.RUnlock()
	return q.getCountFromContext(q.currentCountKey)
}

func (q *quota) Reset(maxCount, maxSpillover int64, resetSpillover bool) {
	q.mutex.Lock()
	defer q.mutex.Unlock()
	spilloverCount := q.getCountFromContext(q.spilloverCountKey)

	if resetSpillover {
		q.storeCountIntoContext(0, q.spilloverCountKey)
	} else if q.withSpillover {
		currentCount := q.getCountFromContext(q.currentCountKey)
		q.storeCountIntoContext(
			(spilloverCount+(maxCount-currentCount))%maxSpillover,
			q.spilloverCountKey)
	}
	q.storeCountIntoContext(0, q.currentCountKey)
	q.allowedReq = make(map[string]quotaCounterUsed)
}

func (q *quota) Inc(APIStream publictypes.APIStreamI) {
	q.mutex.Lock()
	defer q.mutex.Unlock()
	reqID := APIStream.GetID()

	if q.isReqIDAlreadyAllowed(reqID) != notUsed {
		return
	}

	var spilloverCount int64
	if q.withSpillover {
		spilloverCount = q.getCountFromContext(q.spilloverCountKey)
	}

	counterUsed := notUsed //nolint: ineffassign
	if spilloverCount > 0 {
		q.logger.Trace().Int64("spilloverCount", spilloverCount).Msg("Using spillover")
		spilloverUpdatedCount := spilloverCount - 1
		q.logger.Trace().Msgf("Decrementing spillover count to: %d", spilloverUpdatedCount)
		q.storeCountIntoContext(spilloverUpdatedCount, q.spilloverCountKey)
		counterUsed = spillover
	} else {
		currentCount := q.getCountFromContext(q.currentCountKey) + 1
		q.logger.Trace().
			Str("reqID", reqID).
			Msgf("Incrementing current count to: %d", currentCount)

		q.storeCountIntoContext(currentCount, q.currentCountKey)
		counterUsed = counter
	}
	if currentCount := q.getCountFromContext(q.currentCountKey); currentCount <= q.maxCount {
		q.setReqIDAsAllowed(reqID, counterUsed)
	}
}

func (q *quota) Dec(APIStream publictypes.APIStreamI) {
	q.mutex.Lock()
	defer q.mutex.Unlock()
	reqID := APIStream.GetID()
	usedCounter := q.isReqIDAlreadyAllowed(reqID)
	switch usedCounter {
	case notUsed:
		return
	case counter:
		q.logger.Trace().Msg("Returning current count use")
		q.storeCountIntoContext(q.getCountFromContext(q.currentCountKey)-1, q.currentCountKey)
	case spillover:
		q.logger.Trace().Msg("Returning spillover use")
		q.storeCountIntoContext(q.getCountFromContext(q.spilloverCountKey)+1, q.spilloverCountKey)
	}
	delete(q.allowedReq, reqID)
}

func (q *quota) Allowed(APIStream publictypes.APIStreamI) bool {
	q.Inc(APIStream) // This function uses the mutex lock, so we can call Inc() here
	q.mutex.RLock()
	defer q.mutex.RUnlock()
	return q.isReqIDAlreadyAllowed(APIStream.GetID()) != notUsed
}

func (q *quota) storeCountIntoContext(count int64, key string) {
	q.logger.Debug().Int64("count", count).Str("key", key).Msg("Storing count into context")
	// We don't need to lock here as we are already in a mutex lock
	// (keep it in mind for future reference)
	q.logger.Trace().Int64("count", count).Str("key", key).Msg("Storing count into context")
	err := q.context.Set(key, count)
	if err != nil {
		q.logger.Warn().Err(err).Str("key", q.currentCountKey).Msg("Failed to store count into context")
	}
}

func (q *quota) getCountFromContext(counterKey string) int64 {
	// We don't need to lock here as we are already in a mutex lock
	// (keep it in mind for future reference)
	count, err := q.context.Get(counterKey)
	if err != nil {
		q.logger.Debug().Err(err).Str("key", counterKey).
			Msg("Failed to get count from context, initializing to 0")
		return 0
	}
	return count
}

func (q *quota) setReqIDAsAllowed(reqID string, useType quotaCounterUsed) {
	q.logger.Trace().Str("reqID", reqID).Msg("Adding request ID to increased")
	q.allowedReq[reqID] = useType
}

func (q *quota) isReqIDAlreadyAllowed(reqID string) quotaCounterUsed {
	counterType, found := q.allowedReq[reqID]
	if !found || counterType == notUsed {
		return notUsed
	}
	q.logger.Trace().Str("reqID", reqID).Msg("Request ID was already allowed")
	return counterType
}

type fixedWindow struct {
	quotaID          string
	parent           *resourceutils.QuotaNode[ResourceAdmI]
	context          publictypes.ContextI
	max              int64
	spilloverMax     int64
	groupBy          string
	window           time.Duration
	windowEnd        time.Time
	monthlyRenewal   *MonthlyRenewalData
	nextMonthlyReset time.Time
	spilloverData    *Spillover
	filter           *streamconfig.Filter
	clock            clock.Clock
	logger           zerolog.Logger
	systemFlowData   *resourcetypes.ResourceFlowData
	quotaGroups      map[string]*quota
	getQuotaLock     sync.Mutex
	alignmentLock    sync.Mutex
}

func NewFixedStrategy(
	providerCfg *QuotaConfig,
	parent *resourceutils.QuotaNode[ResourceAdmI],
) (ResourceAdmI, error) {
	if providerCfg.Strategy.FixedWindow == nil {
		return nil, fmt.Errorf("fixed window strategy config is nil")
	}

	fixedWindow := &fixedWindow{
		parent:        parent,
		quotaID:       providerCfg.ID,
		filter:        providerCfg.Filter,
		max:           providerCfg.Strategy.FixedWindow.Max,
		window:        providerCfg.Strategy.FixedWindow.ParseWindow(),
		windowEnd:     epochTime,
		spilloverData: providerCfg.Strategy.FixedWindow.Spillover,
		groupBy:       providerCfg.Strategy.FixedWindow.GetGroup(),
		clock:         contextmanager.Get().GetClock(),
		logger: log.Logger.With().Str("component", "fixedWindow").
			Str("ID", providerCfg.ID).Logger(),
		context:     streamtypes.NewContextManager().GetGlobalContext(),
		quotaGroups: make(map[string]*quota),
	}

	if err := fixedWindow.init(); err != nil {
		return nil, fmt.Errorf("failed to initialize fixed window: %w", err)
	}
	return fixedWindow, nil
}

func (fw *fixedWindow) GetGroupedBy() string {
	if fw.parent != nil {
		return fw.parent.GetQuota().GetGroupedBy()
	}
	fw.logger.Trace().Str("group", fw.groupBy).Msg("Getting group")
	return fw.groupBy
}

func (fw *fixedWindow) GetSystemFlow() *resourcetypes.ResourceFlowData {
	return fw.systemFlowData
}

func (fw *fixedWindow) GetQuotaGroupsCounters() map[string]int64 {
	counters := make(map[string]int64)
	for key, quotaObj := range fw.quotaGroups {
		counters[key] = quotaObj.GetCounter()
	}
	return counters
}

func (fw *fixedWindow) Allowed(APIStream publictypes.APIStreamI) (bool, error) {
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

func (fw *fixedWindow) Dec(APIStream publictypes.APIStreamI) error {
	fw.windowAligning()
	quotaObj, err := fw.getQuota(APIStream)
	if err != nil {
		return err
	}
	quotaObj.Dec(APIStream)
	return nil
}

func (fw *fixedWindow) Inc(APIStream publictypes.APIStreamI) error {
	fw.windowAligning()
	quotaObj, err := fw.getQuota(APIStream)
	if err != nil {
		return err
	}

	quotaObj.Inc(APIStream)
	if fw.parent != nil {
		return fw.parent.GetQuota().Inc(APIStream)
	}
	return nil
}

func (fw *fixedWindow) ResetIn() time.Duration {
	fw.windowAligning()
	return fw.windowEnd.Sub(fw.clock.Now())
}

func (fw *fixedWindow) windowAligning() {
	fw.alignmentLock.Lock()
	defer fw.alignmentLock.Unlock()
	if fw.aligningMonthlyReset() {
		return
	}

	fw.aligningWindowReset()
}

func (fw *fixedWindow) GetID() string {
	return fw.quotaID
}

func (fw *fixedWindow) GetLimit() int64 {
	return fw.max
}

func (fw *fixedWindow) getQuota(APIStream publictypes.APIStreamI) (*quota, error) {
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

	quotaObj := newQuota(quotaKey, fw.logger, fw.max, fw.spilloverMax, fw.spilloverData != nil)
	fw.quotaGroups[quotaKey] = quotaObj
	return quotaObj, nil
}

func (fw *fixedWindow) calculateContextKey(apiStream publictypes.APIStreamI) string {
	var found bool
	groupBy := DefaultGroup

	if fw.groupBy != DefaultGroup {
		groupBy, found = apiStream.GetHeader(groupBy)
		if !found {
			fw.logger.Debug().
				Str("group", groupBy).
				Msg("Failed to locate group header, using default")
			groupBy = DefaultGroup
		}
	}

	return fmt.Sprintf("%s_%s", fw.quotaID, groupBy)
}

func (fw *fixedWindow) init() error {
	fw.validateSpilloverNeeds()
	fw.systemFlowData = &resourcetypes.ResourceFlowData{
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

func (fw *fixedWindow) getProcessors() map[string]publictypes.ProcessorDataI {
	return map[string]publictypes.ProcessorDataI{
		fw.buildProcName(): &streamconfig.Processor{
			Processor: quotaProcessorInc,
			// We need to set the key name as it wont be load by the default way.
			Key: fw.buildProcName(),
			Parameters: []*publictypes.KeyValue{
				{
					Key:   quotaParamKey,
					Value: fw.quotaID,
				},
			},
		},
	}
}

func (fw *fixedWindow) getProcessorsLocation() *resourcetypes.ResourceFlow {
	return &resourcetypes.ResourceFlow{
		Request: &resourcetypes.ResourceProcessorLocation{
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

func (fw *fixedWindow) aligningWindowReset() {
	// In order to ensure proper support for use-cases such as remedy chaining,
	// we align windows on an imaginary grid.
	// This is done by starting the count of passed windows from the
	// initial epoch time in order to compute windows' start (and end) times.
	currentTime := fw.clock.Now()
	elapsedTime := currentTime.Sub(epochTime)

	// These two values represent the correct window we should be working within.
	// The equation is not redundant - it is used for flooring purposes
	currentWindowStartTime := epochTime.Add(
		(elapsedTime / fw.window) * fw.window,
	)
	currentWindowEndTime := currentWindowStartTime.Add(fw.window)

	// We make sure that state's window is is correct accordingly
	if currentTime.After(fw.windowEnd) {
		fw.logger.Trace().Time("old_time", fw.windowEnd).
			Time("new_time", currentWindowEndTime).Msg("Resetting window")
		fw.windowEnd = currentWindowEndTime
		fw.resetQuota(false)
	}
}

func (fw *fixedWindow) aligningMonthlyReset() bool {
	if fw.monthlyRenewal == nil || fw.nextMonthlyReset.IsZero() {
		return false
	}

	shouldReset := fw.clock.Now().After(fw.nextMonthlyReset)
	if shouldReset {
		fw.windowEnd = epochTime
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
		quotaObj.Reset(fw.max, fw.spilloverMax, withSpillover)
	}
}
