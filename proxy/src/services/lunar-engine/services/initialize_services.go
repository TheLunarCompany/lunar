//go:build !pro

package services

import (
	"context"
	"lunar/engine/utils/limit"
	"lunar/engine/utils/queue"
	"lunar/engine/utils/writers"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"time"

	"github.com/rs/zerolog/log"
)

func Initialize(
	_ context.Context,
	clock clock.Clock,
	syslogWriter writers.Writer,
	proxyTimeout time.Duration,
) (*Services, error) {
	contextLogger := logging.ContextLogger{Logger: log.Logger}
	rateLimitState := limit.NewRateLimitState(clock, contextLogger)

	delayedPriorityQueueFactory := func(
		queueKey queue.QueueKey,
	) queue.DelayedPriorityQueueable {
		return queue.NewInMemoryDelayedPriorityQueue(
			queueKey,
			clock,
			contextLogger,
		)
	}
	return initializeServices(
		clock,
		syslogWriter,
		contextLogger,
		proxyTimeout,
		rateLimitState,
		delayedPriorityQueueFactory,
	)
}
