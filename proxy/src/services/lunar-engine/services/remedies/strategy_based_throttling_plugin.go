package remedies

import (
	"context"
	"lunar/engine/actions"
	"lunar/engine/config"
	"lunar/engine/messages"
	"lunar/engine/utils"
	"lunar/engine/utils/limit"
	"lunar/engine/utils/obfuscation"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const (
	defaultResponseStatusCode = 429
	quotaUsedMetricName       = "lunar_remedies.strategy_based_throttling.quota_used"
	quotaLimitMetricName      = "lunar_remedies.strategy_based_throttling.quota_limit"
	consumerTag               = "x-lunar-consumer-tag"
)

type StrategyBasedThrottlingPlugin struct {
	ctx   context.Context
	clock clock.Clock

	rateLimitState limit.IncrementableRateLimitState
	nextWindowTime time.Time

	definedQuotas map[string]int64
	mutex         sync.RWMutex

	obfuscator obfuscation.Obfuscator

	quotaUsedMetric  metric.Int64ObservableGauge
	quotaLimitMetric metric.Int64ObservableGauge
}

func NewStrategyBasedThrottlingPlugin(
	ctx context.Context,
	clock clock.Clock,
	meter metric.Meter,
	rateLimitState limit.IncrementableRateLimitState,
	obfuscator obfuscation.Obfuscator,
) (*StrategyBasedThrottlingPlugin, error) {
	plugin := &StrategyBasedThrottlingPlugin{ //nolint:exhaustruct
		ctx:            ctx,
		clock:          clock,
		rateLimitState: rateLimitState,
		nextWindowTime: clock.Now(),

		definedQuotas: map[string]int64{},
		mutex:         sync.RWMutex{},

		obfuscator: obfuscator,
	}

	if meter != nil {
		quotaUsedMetric, err := plugin.initializeQuotaUsedMetric(meter)
		if err != nil {
			return nil, err
		}
		quotaLimitMetric, err := plugin.initializeQuotaLimitMetric(meter)
		if err != nil {
			return nil, err
		}

		plugin.quotaUsedMetric = quotaUsedMetric
		plugin.quotaLimitMetric = quotaLimitMetric
	}

	return plugin, nil
}

func (plugin *StrategyBasedThrottlingPlugin) OnRequest(
	onRequest messages.OnRequest,
	scopedRemedy config.ScopedRemedy,
) (actions.ReqLunarAction, error) {
	remedyConfig := scopedRemedy.Remedy.Config.StrategyBasedThrottling

	plugin.mutex.Lock()
	plugin.definedQuotas[scopedRemedy.Remedy.Name] = remedyConfig.AllowedRequestCount
	plugin.mutex.Unlock()

	responseStatusCode := defaultResponseStatusCode
	if remedyConfig.ResponseStatusCode != 0 {
		responseStatusCode = remedyConfig.ResponseStatusCode
	}

	groupID, grouping := buildGroupID(
		remedyConfig,
		onRequest,
		plugin.obfuscator,
	)

	requestArgs := limit.RequestArguments{
		LimiterID: scopedRemedy.Remedy.Name,
		Grouping:  grouping,
		GroupID:   groupID,
	}

	quotaAllocationRatio := float64(1)
	if remedyConfig.GroupQuotaAllocation != nil {
		var found bool
		quotaAllocationRatio, found = getQuotaAllocationRatio(
			remedyConfig,
			onRequest,
		)

		if !found {
			log.Trace().Msgf(
				"[%v] Quota allocation not found, using default behavior %v",
				groupID,
				remedyConfig.GroupQuotaAllocation.Default,
			)

			switch remedyConfig.GroupQuotaAllocation.DefaultBehavior() {
			case sharedConfig.DefaultQuotaGroupBehaviorAllow:
				return &actions.NoOpAction{}, nil
			case sharedConfig.DefaultQuotaGroupBehaviorBlock:
				action := plainTextTooManyRequestsAction(responseStatusCode)
				return &action, nil
			case sharedConfig.DefaultQuotaGroupBehaviorUseDefaultAllocation:
				quotaAllocationRatio = remedyConfig.GroupQuotaAllocation.DefaultAllocationPercentage / 100
			case sharedConfig.DefaultQuotaGroupBehaviorUndefined:
				return &actions.NoOpAction{}, nil
			}
		}
	}

	windowData := limit.WindowData{
		WindowSize: time.Duration(
			remedyConfig.WindowSizeInSeconds,
		) * time.Second,
		AllowedRequestCount:  remedyConfig.AllowedRequestCount,
		QuotaAllocationRatio: quotaAllocationRatio,
		SpilloverRenewOnDay:  remedyConfig.SpilloverConfig.RenewOnDay,
		SpilloverEnabled:     remedyConfig.SpilloverConfig.Enabled,
	}

	currentLimitState, err := plugin.rateLimitState.TryToIncrement(
		requestArgs,
		windowData,
	)
	if err != nil {
		return nil, err
	}

	if log.Trace().Enabled() {
		logRateLimitState(
			scopedRemedy,
			grouping,
			groupID,
			currentLimitState.NewCounter,
			remedyConfig.SpilloverConfig.Enabled,
		)
	}

	if currentLimitState.LimitSate == limit.Block {
		action := plainTextTooManyRequestsAction(responseStatusCode)
		return &action, err
	}

	return &actions.NoOpAction{}, err
}

func getQuotaAllocationRatio(
	remedyConfig *sharedConfig.StrategyBasedThrottlingConfig,
	onRequest messages.OnRequest,
) (float64, bool) {
	for _, allocation := range remedyConfig.GroupQuotaAllocation.Groups {
		if allocation.GroupHeaderValue ==
			onRequest.Headers[remedyConfig.GroupQuotaAllocation.GroupBy.HeaderName] {
			return allocation.AllocationPercentage / 100, true
		}
	}
	return 0, false
}

func (plugin *StrategyBasedThrottlingPlugin) OnResponse(
	_ messages.OnResponse,
	_ config.ScopedRemedy,
) (actions.RespLunarAction, error) {
	return &actions.NoOpAction{}, nil
}

func buildGroupID(
	remedyConfig *sharedConfig.StrategyBasedThrottlingConfig,
	onRequest messages.OnRequest,
	obfuscator obfuscation.Obfuscator,
) (limit.GroupID, limit.Grouping) {
	if remedyConfig.GroupQuotaAllocation == nil {
		return limit.UngroupedLimit, limit.Ungrouped
	}

	groupHeaderName := remedyConfig.GroupQuotaAllocation.GroupBy.HeaderName
	headerValue := onRequest.Headers[groupHeaderName]
	obfuscatedHeaderValue := obfuscator.ObfuscateString(headerValue)
	headerName := strings.ToLower(groupHeaderName)
	groupID := headerName + ":" + strings.TrimSpace(obfuscatedHeaderValue)

	return groupID, limit.Grouped
}

func logRateLimitState(
	scopedRemedy config.ScopedRemedy,
	grouping limit.Grouping,
	groupID limit.GroupID,
	counter int64,
	isSpillover bool,
) {
	switch scopedRemedy.Scope {
	case utils.ScopeGlobal:
		switch grouping {
		case limit.Ungrouped:
			log.Trace().Msgf(
				"Rate limit counter: %v, isSpillover: %v",
				counter,
				isSpillover,
			)
		case limit.Grouped:
			log.Trace().Msgf(
				"Rate limit counter for [%v]: %v, isSpillover: %v",
				groupID,
				counter,
				isSpillover,
			)
		}
	case utils.ScopeEndpoint:
		switch grouping {
		case limit.Grouped:
			log.Trace().Msgf(
				"Rate limit counter for %v %v [%v]: %v, isSpillover: %v",
				scopedRemedy.Method,
				scopedRemedy.NormalizedURL,
				groupID,
				counter,
				isSpillover,
			)

		case limit.Ungrouped:
			log.Trace().Msgf(
				"Rate limit counter for %v %v: %v, isSpillover: %v",
				scopedRemedy.Method,
				scopedRemedy.NormalizedURL,
				counter,
				isSpillover,
			)
		}
	}
}

func (plugin *StrategyBasedThrottlingPlugin) initializeQuotaUsedMetric(
	meter metric.Meter,
) (metric.Int64ObservableGauge, error) {
	quotaUsedMetric, err := meter.Int64ObservableGauge(
		quotaUsedMetricName,
		metric.WithDescription("Used quota for strategy based throttling"),
		metric.WithInt64Callback(plugin.observeQuotaUsed),
	)
	if err != nil {
		return nil, err
	}
	return quotaUsedMetric, nil
}

func (plugin *StrategyBasedThrottlingPlugin) initializeQuotaLimitMetric(
	meter metric.Meter,
) (metric.Int64ObservableGauge, error) {
	quotaLimitMetric, err := meter.Int64ObservableGauge(
		quotaLimitMetricName,
		metric.WithDescription("Quota limit for strategy based throttling"),
		metric.WithInt64Callback(plugin.observeQuotaLimit),
	)
	if err != nil {
		return nil, err
	}
	return quotaLimitMetric, nil
}

func (plugin *StrategyBasedThrottlingPlugin) observeQuotaLimit(
	_ context.Context,
	observer metric.Int64Observer,
) error {
	plugin.mutex.RLock()
	defer plugin.mutex.RUnlock()

	for limiterID, quota := range plugin.definedQuotas {
		observer.Observe(
			int64(quota),
			metric.WithAttributes(
				attribute.String("remedy_name", limiterID),
			),
		)
	}

	return nil
}

func (plugin *StrategyBasedThrottlingPlugin) observeQuotaUsed(
	_ context.Context,
	observer metric.Int64Observer,
) error {
	plugin.mutex.RLock()
	defer plugin.mutex.RUnlock()

	for requestArgs, counter := range plugin.rateLimitState.Counters() {
		attributes := []attribute.KeyValue{
			attribute.String("group_id", string(requestArgs.GroupID)),
			attribute.String("remedy_name", requestArgs.LimiterID),
		}

		observer.Observe(int64(counter), metric.WithAttributes(attributes...))
	}
	return nil
}
