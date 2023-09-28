package remedies

import (
	"lunar/engine/actions"
	"lunar/engine/config"
	"lunar/engine/messages"
	"lunar/engine/utils"
	"lunar/engine/utils/limit"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"math"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

const defaultResponseStatusCode = 429

type StrategyBasedThrottlingPlugin struct {
	clock          clock.Clock
	rateLimitState limit.RateLimitState
	nextWindowTime time.Time
}

func NewStrategyBasedThrottlingPlugin(
	clock clock.Clock,
) *StrategyBasedThrottlingPlugin {
	return &StrategyBasedThrottlingPlugin{
		clock:          clock,
		rateLimitState: limit.NewRateLimitStateByEndpoint(clock),
		nextWindowTime: clock.Now(),
	}
}

func (plugin *StrategyBasedThrottlingPlugin) OnRequest(
	onRequest messages.OnRequest,
	scopedRemedy config.ScopedRemedy,
) (actions.ReqLunarAction, error) {
	remedyConfig := scopedRemedy.Remedy.Config.StrategyBasedThrottling

	responseStatusCode := defaultResponseStatusCode
	if remedyConfig.ResponseStatusCode != 0 {
		responseStatusCode = remedyConfig.ResponseStatusCode
	}

	windowSize := time.Duration(remedyConfig.WindowSizeInSeconds) * time.Second

	groupID, grouping := buildGroupID(remedyConfig, onRequest)

	requestArgs := limit.RequestArguments{
		RequestScope:  scopedRemedy.Scope,
		Grouping:      grouping,
		GroupID:       groupID,
		Method:        scopedRemedy.Method,
		NormalizedURL: scopedRemedy.NormalizedURL,
	}

	quotaAllocationRatio := float64(1)
	if remedyConfig.GroupQuotaAllocation != nil {
		var found bool
		quotaAllocationRatio, found = getQuotaAllocationRatio(remedyConfig, onRequest)

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
				quotaAllocationRatio = remedyConfig.GroupQuotaAllocation.DefaultAllocationPercentage / 100 //nolint:lll
			case sharedConfig.DefaultQuotaGroupBehaviorUndefined:
				return &actions.NoOpAction{}, nil
			}
		}
	}

	maxAllowRequests := int(math.Ceil(
		float64(remedyConfig.AllowedRequestCount) * quotaAllocationRatio))

	if grouping == limit.Grouped {
		log.Trace().Msgf("[%v] Quota allocation: %v, Max allowed requests: %v",
			groupID, quotaAllocationRatio, maxAllowRequests)
	} else {
		log.Trace().Msgf("Max allowed requests: %v", maxAllowRequests)
	}

	counter, err := plugin.rateLimitState.Increment(requestArgs, windowSize)
	if err != nil {
		return nil, err
	}

	if log.Trace().Enabled() {
		logRateLimitState(scopedRemedy, grouping, groupID, counter)
	}

	if counter > maxAllowRequests {
		action := plainTextTooManyRequestsAction(responseStatusCode)
		return &action, nil
	}

	return &actions.NoOpAction{}, nil
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
) (limit.GroupID, limit.Grouping) {
	if remedyConfig.GroupQuotaAllocation == nil {
		return "", limit.Ungrouped
	}

	groupHeaderName := remedyConfig.GroupQuotaAllocation.GroupBy.HeaderName
	headerValue := onRequest.Headers[groupHeaderName]
	headerName := strings.ToLower(groupHeaderName)
	groupID := headerName + ":" + strings.TrimSpace(headerValue)

	return groupID, limit.Grouped
}

func logRateLimitState(
	scopedRemedy config.ScopedRemedy,
	grouping limit.Grouping,
	groupID limit.GroupID,
	counter int,
) {
	switch scopedRemedy.Scope {
	case utils.ScopeGlobal:
		switch grouping {
		case limit.Ungrouped:
			log.Trace().Msgf(
				"Rate limit counter: %v",
				counter,
			)
		case limit.Grouped:
			log.Trace().Msgf(
				"Rate limit counter for [%v]: %v",
				groupID,
				counter,
			)
		}
	case utils.ScopeEndpoint:
		log.Trace().Msgf(
			"Rate limit counter for %v %v [%v]: %v",
			scopedRemedy.Method,
			scopedRemedy.NormalizedURL,
			groupID,
			counter,
		)
	}
}
