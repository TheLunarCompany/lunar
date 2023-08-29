package remedies

import (
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/messages"
	"lunar/engine/utils"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"

	"github.com/rs/zerolog/log"
)

const (
	LunarRetryAfterHeaderName = "x-lunar-retry-after"
	transactionTimeoutSec     = 30
	networkTimeBufferSec      = 1
)

type RetryState struct {
	attemptsLeft        int
	nextCooldownSeconds int
}

type RetryPlugin struct {
	cache utils.Cache[string, RetryState]
}

func NewRetryPlugin(clock clock.Clock) *RetryPlugin {
	return &RetryPlugin{
		cache: utils.NewMemoryCache[string, RetryState](clock),
	}
}

func (plugin *RetryPlugin) OnRequest(
	_ messages.OnRequest,
	_ *sharedConfig.RetryConfig,
) (actions.ReqLunarAction, error) {
	return &actions.NoOpAction{}, nil
}

// Even though this plugin reads & updates sequence-level state over cache,
// We do not lock it on this level (only the locks that the cache uses to
// ensure validity). This is because the semantics of the sequence means
// that request arrive sequentially, and this is not the way to ensure that we
// have no bugs on the interceptor's side - the performance price to pay
// is too high.
func (plugin *RetryPlugin) OnResponse(
	onResponse messages.OnResponse,
	remedyConfig *sharedConfig.RetryConfig,
) (actions.RespLunarAction, error) {
	for _, statusRange := range remedyConfig.Conditions.StatusCode {
		if onResponse.Status < statusRange.From ||
			onResponse.Status > statusRange.To {
			continue
		}
		retryState, found := plugin.cache.Get(onResponse.SequenceID)
		if !found {
			if !onResponse.IsNewSequence() {
				return &actions.NoOpAction{}, nil
			}
			retryState = RetryState{
				attemptsLeft:        remedyConfig.Attempts,
				nextCooldownSeconds: remedyConfig.InitialCooldownSeconds,
			}
		}

		lunarRetryAfterValue := fmt.Sprint(retryState.nextCooldownSeconds)
		action := actions.ModifyResponseAction{
			HeadersToSet: map[string]string{
				LunarRetryAfterHeaderName: lunarRetryAfterValue,
			},
		}

		updatedRetryState := RetryState{
			attemptsLeft: retryState.attemptsLeft - 1,
			nextCooldownSeconds: retryState.nextCooldownSeconds *
				remedyConfig.CooldownMultiplier,
		}

		ttlSec := retryState.nextCooldownSeconds +
			transactionTimeoutSec +
			networkTimeBufferSec

		if updatedRetryState.attemptsLeft < 1 {
			plugin.cache.Del(onResponse.SequenceID)
		} else {
			plugin.cache.Set(
				onResponse.SequenceID,
				updatedRetryState,
				float64(ttlSec),
			)
		}

		log.Debug().
			Msgf("Retry required, will return ModifyResponseAction. "+
				"updatedRetryState: %+v", updatedRetryState)
		return &action, nil
	}

	// Ensure cache is cleared in case retry is not required
	// according to configured status ranges
	plugin.cache.Del(onResponse.SequenceID)

	log.Debug().Msg("Retry is not required, will return NoOp")
	return &actions.NoOpAction{}, nil
}
