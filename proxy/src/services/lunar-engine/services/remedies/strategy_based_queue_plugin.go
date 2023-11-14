package remedies

import (
	"lunar/engine/actions"
	"lunar/engine/config"
	"lunar/engine/messages"
	"lunar/engine/utils/queue"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

type StrategyBasedQueuePlugin struct {
	clock       clock.Clock
	queuesMutex sync.RWMutex
	queues      map[string]*queue.DelayedPriorityQueue
}

func NewStrategyBasedQueuePlugin(
	clock clock.Clock,
) *StrategyBasedQueuePlugin {
	return &StrategyBasedQueuePlugin{
		clock:       clock,
		queuesMutex: sync.RWMutex{},
		queues:      map[string]*queue.DelayedPriorityQueue{},
	}
}

func (plugin *StrategyBasedQueuePlugin) OnRequest(
	onRequest messages.OnRequest,
	scopedRemedy config.ScopedRemedy,
) (actions.ReqLunarAction, error) {
	remedyConfig := scopedRemedy.Remedy.Config.StrategyBasedQueue
	if remedyConfig == nil {
		log.Error().Err(ErrMissingConfig).Msg("remedy config missing")
		return &actions.NoOpAction{}, ErrMissingConfig
	}

	plugin.queuesMutex.Lock()
	relevantQueue, found := plugin.queues[scopedRemedy.Remedy.Name]
	if !found {
		relevantQueue = queue.NewDelayedPriorityQueue(
			remedyConfig.AllowedRequestCount,
			time.Duration(remedyConfig.WindowSizeInSeconds)*time.Second,
			plugin.clock,
		)
		log.Trace().Msgf("initialized delayed prioritized queue for %s",
			scopedRemedy.Remedy.Name)
		plugin.queues[scopedRemedy.Remedy.Name] = relevantQueue
	}
	plugin.queuesMutex.Unlock()

	priority := extractPriority(onRequest, *remedyConfig)
	log.Trace().Str("requestID", onRequest.ID).
		Msgf("extracted priority %d", priority)

	request := queue.NewRequest(onRequest.ID, priority, plugin.clock)
	canProceed := relevantQueue.Enqueue(
		request,
		time.Duration(remedyConfig.TTLSeconds)*time.Second,
	)
	log.Trace().
		Str("requestID", onRequest.ID).
		Msgf("can proceed response: %v", canProceed)

	if canProceed {
		return &actions.NoOpAction{}, nil
	}

	log.Trace().Str("requestID", onRequest.ID).
		Msgf("request cannot be processed, will return early response")
	action := plainTextTooManyRequestsAction(
		remedyConfig.ResponseStatusCode,
	)
	return &action, nil
}

// If priority is not defined/find, it will default to 0,
// which is the highest priority.
func extractPriority(
	onRequest messages.OnRequest,
	remedyConfig sharedConfig.StrategyBasedQueueConfig,
) int {
	if remedyConfig.Prioritization == nil {
		return 0
	}
	headerName := remedyConfig.Prioritization.GroupBy.HeaderName
	headerValue := onRequest.Headers[headerName]
	prioritization := remedyConfig.Prioritization.Groups[headerValue]

	return prioritization.Priority
}

func (plugin *StrategyBasedQueuePlugin) OnResponse(
	_ messages.OnResponse,
	_ config.ScopedRemedy,
) (actions.RespLunarAction, error) {
	return &actions.NoOpAction{}, nil
}
