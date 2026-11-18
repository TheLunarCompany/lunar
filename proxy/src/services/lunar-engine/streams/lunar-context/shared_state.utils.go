package lunarcontext

import (
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

const iterationIdleTimeout = 2 * time.Minute

type removeKeyFunc[T any] func(key string) (T, error)

type ExpireWatcher[T any] struct {
	started        bool
	mu             sync.Mutex
	stopCh         chan struct{}
	removeFunction removeKeyFunc[T]
	keysToRemove   map[string]time.Time
}

var (
	ewInstances  = make(map[string]interface{})
	ewGetterLock sync.Mutex
)

func GetExpireWatcher[T any](removeFunc removeKeyFunc[T]) *ExpireWatcher[T] {
	key := fmt.Sprintf("%T", removeFunc)

	ewGetterLock.Lock()
	defer ewGetterLock.Unlock()
	if _, ok := ewInstances[key]; !ok {
		ewInstances[key] = newEW(removeFunc)
	}

	return ewInstances[key].(*ExpireWatcher[T])
}

func newEW[T any](removeFunc removeKeyFunc[T]) *ExpireWatcher[T] {
	ew := &ExpireWatcher[T]{
		keysToRemove:   make(map[string]time.Time),
		removeFunction: removeFunc,
	}

	return ew
}

func (ew *ExpireWatcher[T]) AddKey(
	key string,
	expiration time.Duration,
) {
	ew.mu.Lock()
	defer ew.mu.Unlock()

	if !ew.started {
		ew.started = true
		go ew.startExpirationWorker()
	}

	ew.keysToRemove[key] = time.Now().Add(expiration)
}

func (ew *ExpireWatcher[T]) startExpirationWorker() {
	ticker := time.NewTicker(iterationIdleTimeout)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			log.Trace().Msgf("ExpireWatcher::Removing expired keys %+v\n", ew.keysToRemove)
			ew.removeExpiredKeys()

		case <-ew.stopCh:
			return
		}
	}
}

func (ew *ExpireWatcher[T]) removeExpiredKeys() {
	ew.mu.Lock()
	defer ew.mu.Unlock()

	for key, expirationTime := range ew.keysToRemove {
		if time.Now().Before(expirationTime) {
			continue
		}

		_, err := ew.removeFunction(key)
		if err != nil {
			log.Debug().Msgf("ExpireWatcher::Failed to remove key: %s\n", key)
		}

		delete(ew.keysToRemove, key)
		log.Trace().Msgf("ExpireWatcher::Removed key: %s\n", key)
	}
}

const (
	gcInitBachSize        = 200
	gcInitAvgRedisLatency = 5 * time.Millisecond
	gsTargetBachTime      = 40 * time.Millisecond
)

type QueueGCConfigurations struct {
	mutex           sync.RWMutex
	gcBatchSize     int
	avgRedisLatency time.Duration
}

func NewQueueGCConfigurations() *QueueGCConfigurations {
	return &QueueGCConfigurations{
		gcBatchSize:     gcInitBachSize,
		avgRedisLatency: gcInitAvgRedisLatency,
	}
}

func (qgc *QueueGCConfigurations) GetBatchSize() int {
	qgc.mutex.RLock()
	defer qgc.mutex.RUnlock()
	return qgc.gcBatchSize
}

func (qgc *QueueGCConfigurations) AdjustBatchSize(
	redisCallDuration time.Duration,
	batchDuration time.Duration,
	itemsCount int,
) {
	qgc.mutex.Lock()
	defer qgc.mutex.Unlock()
	// Update average Redis Latency
	qgc.avgRedisLatency = (qgc.avgRedisLatency*9 + redisCallDuration) / 10

	// Calculate Desired Batch Size base on time
	desiredBatchSize := int(float64(gsTargetBachTime) /
		float64(qgc.avgRedisLatency) * float64(itemsCount))

	// Adjust Batch Size
	if batchDuration > gsTargetBachTime {
		// Batch took too long -> decrease
		qgc.gcBatchSize = int(float64(qgc.gcBatchSize) * 0.9)
		if qgc.gcBatchSize < 100 {
			qgc.gcBatchSize = 100
		}
		log.Debug().Msgf("Decreasing batch size to %d", qgc.gcBatchSize)

	} else if batchDuration < gsTargetBachTime/2 && desiredBatchSize > qgc.gcBatchSize {
		// Batch was fast & Desired Batch is bigger -> Increase
		qgc.gcBatchSize = int(float64(desiredBatchSize) * 1.1)
		log.Debug().Msgf("Increasing batch size to %d", qgc.gcBatchSize)
	}
}
