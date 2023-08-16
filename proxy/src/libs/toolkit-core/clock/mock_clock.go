package clock

import (
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

func (m *MockClock) Now() time.Time {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return m.currentTime
}

func (m *MockClock) Sleep(d time.Duration) {
	log.Debug().Msgf("Sleeping for %s", d)
	m.mutex.RLock()
	timeToWakeup := m.currentTime.Add(d)
	shouldWakeUp := m.currentTime.After(timeToWakeup)
	m.mutex.RUnlock()
	if shouldWakeUp {
		log.Debug().Msg("Already past time to wake up")
		return
	}
	for range m.wakeup {
		m.mutex.RLock()
		shouldWakeUp := m.currentTime.After(timeToWakeup)
		m.mutex.RUnlock()
		if shouldWakeUp {
			log.Debug().Msg("Waking up")
			return
		}
	}
}

func (m *MockClock) AdvanceTime(d time.Duration) {
	log.Debug().Msgf("Advancing time by %s", d)
	m.mutex.Lock()
	m.currentTime = m.currentTime.Add(d)
	m.mutex.Unlock()
	m.wakeup <- true
}

func NewMockClock() *MockClock {
	return &MockClock{
		currentTime: time.Now(),
		wakeup:      make(chan bool, 10),
		mutex:       sync.RWMutex{},
	}
}
