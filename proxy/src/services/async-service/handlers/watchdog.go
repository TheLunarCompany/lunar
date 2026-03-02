//go:build pro

package handlers

import (
	context_manager "lunar/toolkit-core/context-manager"
	protocol_async "lunar/toolkit-core/network/protocols/async"
	redis_client "lunar/toolkit-core/redis-client"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	idleWaitMin         = 5
	initBachSize        = 200
	initAvgRedisLatency = 5 * time.Millisecond
	targetBachTime      = 40 * time.Millisecond
)

type Watchdog struct {
	done            chan bool
	protocol        *protocol_async.Protocol
	mutex           sync.RWMutex
	batchSize       int
	avgRedisLatency time.Duration
}

func NewWatchdog(protocol *protocol_async.Protocol) *Watchdog {
	return &Watchdog{
		protocol:        protocol,
		done:            make(chan bool),
		batchSize:       initBachSize,
		avgRedisLatency: initAvgRedisLatency,
	}
}

func (wd *Watchdog) Start() {
	go wd.validateRequests()
}

func (wd *Watchdog) Stop() {
	wd.done <- true
}

func (wd *Watchdog) validateRequests() {
	clock := context_manager.Get().GetClock()

	for {
		select {
		case <-clock.After(time.Duration(idleWaitMin) * time.Minute):
			wd.validatePendingRequests()
		case <-wd.done:
			log.Debug().Msg("Received done signal, exiting")
			return
		}
	}
}

func (wd *Watchdog) validatePendingRequests() {
	pendingQueueSize := wd.protocol.GetQueueSize(protocol_async.QueuePending)
	if pendingQueueSize == 0 {
		return
	}

	availableQueues, err := wd.protocol.GetAvailableEngineQueues()
	if err != nil {
		log.Debug().Err(err).Msg("Failed to get available queues")
		return
	}

	availableQueuesKeys := make([]redis_client.Key, len(availableQueues))
	for _, queueRawKey := range availableQueues {
		parsedKey := strings.Split(queueRawKey, redis_client.Delimiter)
		if len(parsedKey) < 2 {
			log.Debug().Msgf("Invalid queue key format: %v", queueRawKey)
			continue
		}
		queueKey := redis_client.NewKey()
		for i := 1; i < len(parsedKey)-1; i++ {
			queueKey.Append(redis_client.UnhashedKeyPart(parsedKey[i]))
		}

		availableQueuesKeys = append(availableQueuesKeys, queueKey)
	}

	batchSize := wd.getBatchSize()
	if batchSize <= 0 {
		batchSize = 1
	}

	numBatches := int(pendingQueueSize) / batchSize
	if int(pendingQueueSize)%batchSize != 0 {
		numBatches++
	}
	for i := 0; i < numBatches; i++ {
		log.Trace().Msgf("Processing batch %d/%d", i+1, numBatches)
		start := int64(i * batchSize)
		end := start + int64(batchSize) - 1
		if end >= pendingQueueSize {
			end = pendingQueueSize - 1
		}
		wd.processBatch(start, end, availableQueuesKeys)
	}
}

func (wd *Watchdog) processBatch(start, end int64, availableQueues []redis_client.Key) {
	clock := context_manager.Get().GetClock()
	startTime := clock.Now()
	result, err := wd.protocol.ZRangeFromToOnQueue(protocol_async.QueuePending, start, end)
	redisCallDuration := clock.Since(startTime)
	if err != nil || len(result) == 0 {
		return
	}

	for _, member := range result {
		asyncReq, err := protocol_async.NewAsyncRequestData(nil, &member)
		if err != nil {
			log.Debug().Err(err).Msg("Failed to create async request data")
			continue
		}
		if asyncReq == nil {
			log.Debug().Msg("Async request data is nil")
			continue
		}
		reqValid := false
		for _, queue := range availableQueues {
			found := false
			found, err = wd.protocol.IsRequestInEngineQueue(asyncReq, queue)
			if err != nil {
				log.Debug().Err(err).Msg("Failed to check if request is in engine queue")
				continue
			}
			if found {
				log.Trace().Msgf("Request %s is valid in queue %v", asyncReq.ID, queue)
				reqValid = true
				break
			}
		}

		if !reqValid {
			log.Debug().Msgf("Request %s is not valid, adding to Idle queue", asyncReq.ID)
			err = wd.protocol.RemoveRequestFromPendingQueue(asyncReq)
			if err != nil {
				log.Debug().Err(err).Msg("Failed to remove request from pending queue")
			}

			err = wd.protocol.AddRequestToIdleQueue(asyncReq)
			if err != nil {
				log.Debug().Err(err).Msg("Failed to add request to Idle queue")
			}
		}

	}

	batchDuration := clock.Since(startTime)
	wd.adjustBatchSize(redisCallDuration, batchDuration, len(result))
}

func (wd *Watchdog) getBatchSize() int {
	wd.mutex.RLock()
	defer wd.mutex.RUnlock()
	return wd.batchSize
}

func (wd *Watchdog) adjustBatchSize(
	redisCallDuration time.Duration,
	batchDuration time.Duration,
	itemsCount int,
) {
	wd.mutex.Lock()
	defer wd.mutex.Unlock()
	// Update average Redis Latency
	wd.avgRedisLatency = (wd.avgRedisLatency*9 + redisCallDuration) / 10

	// Calculate Desired Batch Size base on time
	desiredBatchSize := int(float64(targetBachTime) /
		float64(wd.avgRedisLatency) * float64(itemsCount))

	// Adjust Batch Size
	if batchDuration > targetBachTime {
		// Batch took too long -> decrease
		wd.batchSize = int(float64(wd.batchSize) * 0.9)
		if wd.batchSize < 100 {
			wd.batchSize = 100
		}
		log.Debug().Msgf("Decreasing batch size to %d", wd.batchSize)

	} else if batchDuration < targetBachTime/2 && desiredBatchSize > wd.batchSize {
		// Batch was fast & Desired Batch is bigger -> Increase
		wd.batchSize = int(float64(desiredBatchSize) * 1.1)
		log.Debug().Msgf("Increasing batch size to %d", wd.batchSize)
	}
}
