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

var ewInstances = make(map[string]interface{})

func GetExpireWatcher[T any](removeFunc removeKeyFunc[T]) *ExpireWatcher[T] {
	key := fmt.Sprintf("%T", removeFunc)

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
