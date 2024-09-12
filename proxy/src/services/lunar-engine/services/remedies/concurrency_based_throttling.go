package remedies

import (
	"lunar/engine/actions"
	"lunar/engine/config"
	"lunar/engine/messages"
	"lunar/engine/utils/limit/concurrency"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/concurrentmap"
	"time"

	"github.com/rs/zerolog/log"
)

// Merely a sensible default for limiters' vacuum tick.
const vacuumTick = 500 * time.Millisecond

func NewConcurrencyBasedThrottlingPlugin(
	clock clock.Clock,
	proxyTimeout time.Duration,
) *ConcurrencyBasedThrottlingPlugin {
	return &ConcurrencyBasedThrottlingPlugin{
		limiters: concurrentmap.NewConcurrentMap[config.Endpoint,
			concurrency.Limiter](),
		transactionsInProgress: concurrentmap.NewConcurrentMap[
			string, config.Endpoint](),
		clock:        clock,
		proxyTimeout: proxyTimeout,
	}
}

type ConcurrencyBasedThrottlingPlugin struct {
	limiters concurrentmap.ConcurrentMap[
		config.Endpoint, concurrency.Limiter]
	transactionsInProgress concurrentmap.ConcurrentMap[string, config.Endpoint]
	clock                  clock.Clock
	proxyTimeout           time.Duration
}

func (plugin *ConcurrencyBasedThrottlingPlugin) OnRequest(
	onRequest messages.OnRequest,
	scopedRemedy config.ScopedRemedy,
) (actions.ReqLunarAction, error) {
	remedyConfig := scopedRemedy.Remedy.Config.ConcurrencyBasedThrottling
	if remedyConfig == nil {
		return &actions.NoOpAction{}, ErrMissingConfig
	}

	endpoint := config.Endpoint{
		Method: onRequest.Method,
		URL:    scopedRemedy.NormalizedURL,
	}

	endpointLimiter, found := plugin.limiters.Lookup(endpoint)

	if found {
		isLimitChanged := endpointLimiter.ConcurrencyLimit() != remedyConfig.MaxConcurrentRequests
		if isLimitChanged {
			endpointLimiter.SetConcurrencyLimit(
				remedyConfig.MaxConcurrentRequests,
			)
		}
	} else {
		newLimiter := *concurrency.NewLimiter(
			remedyConfig.MaxConcurrentRequests,
			plugin.proxyTimeout,
			vacuumTick,
			plugin.clock,
		)
		endpointLimiter = plugin.limiters.LookupOrAssign(endpoint, newLimiter)
	}

	if endpointLimiter.TryTakeSlot(onRequest.ID) {
		log.Trace().
			Msgf("Concurrency based throttling managed to get slot for txn %s",
				onRequest.ID)
		plugin.transactionsInProgress.Assign(onRequest.ID, endpoint)

		return &actions.NoOpAction{}, nil
	}

	log.Trace().
		Msgf("Concurrency based throttling couldn't get slot for txn %s",
			onRequest.ID)

	action := plainTextTooManyRequestsAction(remedyConfig.ResponseStatusCode)
	return &action, nil
}

func (plugin *ConcurrencyBasedThrottlingPlugin) OnResponse(
	onResponse messages.OnResponse,
	scopedRemedy config.ScopedRemedy,
) (actions.RespLunarAction, error) {
	remedyConfig := scopedRemedy.Remedy.Config.ConcurrencyBasedThrottling
	if remedyConfig == nil {
		return &actions.NoOpAction{}, ErrMissingConfig
	}

	endpoint, found := plugin.transactionsInProgress.Lookup(onResponse.ID)

	if !found {
		log.Trace().
			Msgf("Concurrency based throttling detected no release "+
				"required for txn %s",
				onResponse.ID)
		return &actions.NoOpAction{}, nil
	}

	plugin.transactionsInProgress.Delete(onResponse.ID)

	limiter, found := plugin.limiters.Lookup(endpoint)
	if !found {
		log.Warn().
			Msg("Endpoint limiter required but not found, " +
				"limiter will not be released")
		return &actions.NoOpAction{}, nil
	}

	limiter.ReleaseSlot(onResponse.ID)
	log.Trace().
		Msgf("Concurrency based throttling released slot for txn %s", onResponse.ID)

	return &actions.NoOpAction{}, nil
}
