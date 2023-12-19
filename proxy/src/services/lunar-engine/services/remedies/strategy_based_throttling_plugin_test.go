//go:build !pro

package remedies_test

import (
	"context"
	"lunar/engine/actions"
	"lunar/engine/config"
	"lunar/engine/services/remedies"
	"lunar/engine/utils"
	"lunar/engine/utils/limit"
	"lunar/engine/utils/obfuscation"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"math"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestWhenOnRequestIsCalledMoreThanAllowedRequestsRateLimitErrorIsReturned(
	t *testing.T,
) {
	t.Parallel()
	allowedRequests := 2
	windowSizeInSeconds := 1
	clock := clock.NewMockClock()
	obfuscator := obfuscation.Obfuscator{Hasher: obfuscation.MD5Hasher{}}
	ctx := context.Background()
	rateLimitState := limit.NewRateLimitState(clock, logging.ContextLogger{})
	plugin, _ := remedies.NewStrategyBasedThrottlingPlugin(
		ctx, clock, nil, rateLimitState, obfuscator)
	remedyConfig := strategyBasedThrottlingRemedyConfig(
		allowedRequests, windowSizeInSeconds, nil)
	onRequestArgs := onRequestArgs()

	scopedRemedy := config.ScopedRemedy{
		Scope:         utils.ScopeEndpoint,
		Method:        "GET",
		NormalizedURL: "test.com/some/path",
		Remedy: &sharedConfig.Remedy{
			Name: "my remedy",
			Config: sharedConfig.RemedyConfig{
				StrategyBasedThrottling: remedyConfig,
			},
		},
	}

	for i := 0; i < allowedRequests; i++ {
		action, err := plugin.OnRequest(onRequestArgs, scopedRemedy)

		assert.Nil(t, err)
		assert.Equal(t, &actions.NoOpAction{}, action)
	}

	action, err := plugin.OnRequest(onRequestArgs, scopedRemedy)

	assert.Nil(t, err)
	wantAction := actions.EarlyResponseAction{
		Status:  429,
		Headers: map[string]string{"Content-Type": "text/plain"},
		Body:    "Too many requests",
	}
	assert.Equal(t, &wantAction, action)

	clock.AdvanceTime(1 * time.Second)

	action, err = plugin.OnRequest(onRequestArgs, scopedRemedy)

	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)
}

func TestWhenGroupQuotaAllocationIsDefinedAndOnRequestIsCalledMoreThanAllowedRequestsRateLimitErrorIsReturned( //nolint:lll
	t *testing.T,
) {
	t.Parallel()
	xGroupHeaderName := "X-Group"
	groupOne := "group1"
	groupTwo := "group2"

	groupOneAllocationRatio := .25
	groupTwoAllocationRatio := .75
	allowedRequests := 4
	windowSizeInSeconds := 1

	clock := clock.NewMockClock()
	obfuscator := obfuscation.Obfuscator{Hasher: obfuscation.MD5Hasher{}}
	ctx := context.Background()
	rateLimitState := limit.NewRateLimitState(clock, logging.ContextLogger{})
	plugin, _ := remedies.NewStrategyBasedThrottlingPlugin(
		ctx, clock, nil, rateLimitState, obfuscator)

	groupBy := sharedConfig.GroupBy{
		HeaderName: xGroupHeaderName,
	}
	groupQuotaAllocation := sharedConfig.GroupQuotaAllocation{
		GroupBy: &groupBy,
		Groups: []sharedConfig.QuotaAllocation{
			{
				GroupHeaderValue:     groupOne,
				AllocationPercentage: groupOneAllocationRatio * 100,
			},
			{
				GroupHeaderValue:     groupTwo,
				AllocationPercentage: groupTwoAllocationRatio * 100,
			},
		},
	}

	remedyConfig := strategyBasedThrottlingRemedyConfig(
		allowedRequests, windowSizeInSeconds, &groupQuotaAllocation)
	requestWithGroupOne := basicRequestArgs(
		map[string]string{xGroupHeaderName: groupOne}, "")
	requestWithGroupTwo := basicRequestArgs(
		map[string]string{xGroupHeaderName: groupTwo}, "")

	scopedRemedy := config.ScopedRemedy{
		Scope:         utils.ScopeEndpoint,
		Method:        "GET",
		NormalizedURL: "test.com/some/path",
		Remedy: &sharedConfig.Remedy{
			Name: "my remedy",
			Config: sharedConfig.RemedyConfig{
				StrategyBasedThrottling: remedyConfig,
			},
		},
	}

	groupOneAllowedRequests := int(
		math.Ceil(float64(allowedRequests) * groupOneAllocationRatio))
	groupTwoAllowedRequests := int(
		math.Ceil(float64(allowedRequests) * groupTwoAllocationRatio))

	for i := 0; i < groupOneAllowedRequests; i++ {
		action, err := plugin.OnRequest(requestWithGroupOne, scopedRemedy)

		assert.Nil(t, err)
		assert.Equal(t, &actions.NoOpAction{}, action)
	}

	for i := 0; i < groupTwoAllowedRequests; i++ {
		action, err := plugin.OnRequest(requestWithGroupTwo, scopedRemedy)

		assert.Nil(t, err)
		assert.Equal(t, &actions.NoOpAction{}, action)
	}

	action, err := plugin.OnRequest(requestWithGroupOne, scopedRemedy)

	assert.Nil(t, err)
	assert.Equal(t, &actions.EarlyResponseAction{
		Status:  429,
		Headers: map[string]string{"Content-Type": "text/plain"},
		Body:    "Too many requests",
	}, action)

	action, err = plugin.OnRequest(requestWithGroupTwo, scopedRemedy)

	assert.Nil(t, err)
	assert.Equal(t, &actions.EarlyResponseAction{
		Status:  429,
		Headers: map[string]string{"Content-Type": "text/plain"},
		Body:    "Too many requests",
	}, action)

	clock.AdvanceTime(1 * time.Second)

	action, err = plugin.OnRequest(requestWithGroupOne, scopedRemedy)

	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)

	action, err = plugin.OnRequest(requestWithGroupTwo, scopedRemedy)

	assert.Nil(t, err)
	assert.Equal(t, &actions.NoOpAction{}, action)
}

func TestWhenRequestFromUnknownGroupArrivesDefaultBehaviorIsUsed(
	t *testing.T,
) {
	t.Parallel()
	xGroupHeaderName := "X-Group"
	groupOne := "group1"
	groupTwo := "group2"

	groupOneAllocationRatio := .2
	groupTwoAllocationRatio := 1.0
	defaultAllocationRatio := .1
	allowedRequests := 10
	windowSizeInSeconds := 1

	clock := clock.NewMockClock()
	obfuscator := obfuscation.Obfuscator{Hasher: obfuscation.MD5Hasher{}}
	ctx := context.Background()
	rateLimitState := limit.NewRateLimitState(clock, logging.ContextLogger{})
	plugin, _ := remedies.NewStrategyBasedThrottlingPlugin(
		ctx, clock, nil, rateLimitState, obfuscator)

	groupBy := sharedConfig.GroupBy{
		HeaderName: xGroupHeaderName,
	}
	groups := []sharedConfig.QuotaAllocation{
		{
			GroupHeaderValue:     groupOne,
			AllocationPercentage: groupOneAllocationRatio * 100,
		},
		{
			GroupHeaderValue:     groupTwo,
			AllocationPercentage: groupTwoAllocationRatio * 100,
		},
	}
	defaultBehaviorOptions := []sharedConfig.DefaultQuotaGroupBehavior{
		sharedConfig.DefaultQuotaGroupBehaviorAllow,
		sharedConfig.DefaultQuotaGroupBehaviorBlock,
		sharedConfig.DefaultQuotaGroupBehaviorUseDefaultAllocation,
		sharedConfig.DefaultQuotaGroupBehaviorUndefined,
	}
	for _, defaultBehavior := range defaultBehaviorOptions {
		clock.AdvanceTime(2 * time.Second)
		groupQuotaAllocation := buildGroupQuotaAllocation(
			&groupBy, groups, defaultBehavior, defaultAllocationRatio)

		remedyConfig := strategyBasedThrottlingRemedyConfig(
			allowedRequests, windowSizeInSeconds, &groupQuotaAllocation)
		requestWithGroupOne := basicRequestArgs(
			map[string]string{xGroupHeaderName: groupOne}, "")
		requestWithGroupTwo := basicRequestArgs(
			map[string]string{xGroupHeaderName: groupTwo}, "")
		requestWithUnknownGroup := basicRequestArgs(
			map[string]string{xGroupHeaderName: "foo"}, "")

		scopedRemedy := config.ScopedRemedy{
			Scope:         utils.ScopeEndpoint,
			Method:        "GET",
			NormalizedURL: "test.com/some/path",
			Remedy: &sharedConfig.Remedy{
				Name: "my remedy",
				Config: sharedConfig.RemedyConfig{
					StrategyBasedThrottling: remedyConfig,
				},
			},
		}

		groupOneAllowedRequests := int(
			math.Ceil(float64(allowedRequests) * groupOneAllocationRatio))
		groupTwoAllowedRequests := int(
			math.Ceil(float64(allowedRequests) * groupTwoAllocationRatio))

		for i := 0; i < groupOneAllowedRequests; i++ {
			action, err := plugin.OnRequest(requestWithGroupOne, scopedRemedy)

			assert.Nil(t, err)
			assert.Equal(t, &actions.NoOpAction{}, action)
		}

		for i := 0; i < groupTwoAllowedRequests; i++ {
			action, err := plugin.OnRequest(requestWithGroupTwo, scopedRemedy)

			assert.Nil(t, err)
			assert.Equal(t, &actions.NoOpAction{}, action)
		}

		action, err := plugin.OnRequest(requestWithGroupOne, scopedRemedy)

		assert.Nil(t, err)
		assert.Equal(t, &actions.EarlyResponseAction{
			Status:  429,
			Headers: map[string]string{"Content-Type": "text/plain"},
			Body:    "Too many requests",
		}, action)

		action, err = plugin.OnRequest(requestWithGroupTwo, scopedRemedy)

		assert.Nil(t, err)
		assert.Equal(t, &actions.EarlyResponseAction{
			Status:  429,
			Headers: map[string]string{"Content-Type": "text/plain"},
			Body:    "Too many requests",
		}, action)

		requestCount := allowedRequests * 2

		wantActions := wantDefaultBehaviorActions(
			defaultBehavior,
			requestCount,
			allowedRequests,
			defaultAllocationRatio,
		)

		for i := 0; i < requestCount; i++ { //nolint:varnamelen
			action, _ := plugin.OnRequest(
				requestWithUnknownGroup,
				scopedRemedy,
			)
			assert.Nil(t, err)

			assert.Equal(
				t,
				wantActions[i],
				action,
				"i: %v, Default behavior: %v",
				i,
				defaultBehavior,
			)
		}
	}
}

func wantDefaultBehaviorActions(
	defaultBehavior sharedConfig.DefaultQuotaGroupBehavior,
	actionCount int,
	allowedRequests int,
	defaultAllocationRatio float64,
) []actions.ReqLunarAction {
	noOpAction := &actions.NoOpAction{}
	rateLimitError := &actions.EarlyResponseAction{
		Status:  429,
		Headers: map[string]string{"Content-Type": "text/plain"},
		Body:    "Too many requests",
	}

	actions := []actions.ReqLunarAction{}

	switch defaultBehavior {
	case sharedConfig.DefaultQuotaGroupBehaviorAllow:
		for i := 0; i < actionCount; i++ {
			actions = append(actions, noOpAction)
		}
	case sharedConfig.DefaultQuotaGroupBehaviorBlock:
		for i := 0; i < actionCount; i++ {
			actions = append(actions, rateLimitError)
		}
	case sharedConfig.DefaultQuotaGroupBehaviorUseDefaultAllocation:
		allowedDefaultRequests := int(
			math.Ceil(float64(allowedRequests) * defaultAllocationRatio))
		for i := 0; i < allowedDefaultRequests; i++ {
			actions = append(actions, noOpAction)
		}
		for i := 0; i < actionCount-allowedDefaultRequests; i++ {
			actions = append(actions, rateLimitError)
		}
	case sharedConfig.DefaultQuotaGroupBehaviorUndefined:
		for i := 0; i < actionCount; i++ {
			actions = append(actions, noOpAction)
		}
	}

	return actions
}

func buildGroupQuotaAllocation(
	groupBy *sharedConfig.GroupBy,
	groups []sharedConfig.QuotaAllocation,
	defaultBehavior sharedConfig.DefaultQuotaGroupBehavior,
	defaultAllocationRatio float64,
) sharedConfig.GroupQuotaAllocation {
	return sharedConfig.GroupQuotaAllocation{
		GroupBy:                     groupBy,
		Groups:                      groups,
		Default:                     defaultBehavior.String(),
		DefaultAllocationPercentage: defaultAllocationRatio * 100,
	}
}

func strategyBasedThrottlingRemedyConfig(
	allowedRequests int,
	windowSizeInSeconds int,
	groupQuotaAllocation *sharedConfig.GroupQuotaAllocation,
) *sharedConfig.StrategyBasedThrottlingConfig {
	return &sharedConfig.StrategyBasedThrottlingConfig{
		AllowedRequestCount:  allowedRequests,
		WindowSizeInSeconds:  windowSizeInSeconds,
		GroupQuotaAllocation: groupQuotaAllocation,
		ResponseStatusCode:   429,
	}
}
