package contextmanager

import (
	"context"
	"lunar/toolkit-core/clock"
	interfaces "lunar/toolkit-core/interfaces"
	statusMessage "lunar/toolkit-core/status-message"
	"sync"

	"github.com/rs/zerolog/log"
)

// Manager is the singleton that holds the context and clock
type ContextManager struct {
	mu              sync.RWMutex
	ctx             context.Context
	clock           clock.Clock
	statusMessage   *statusMessage.StatusMessage
	clusterLiveness interfaces.ClusterLivenessI
}

var (
	instance *ContextManager
	once     sync.Once
)

func Get() *ContextManager {
	once.Do(func() {
		instance = &ContextManager{
			ctx:           context.Background(),
			clock:         clock.NewRealClock(),
			statusMessage: statusMessage.NewStatusMessage(),
		}
	})
	return instance
}

// WithContext returns a new instance of ContextManager with the provided context
func (m *ContextManager) WithContext(ctx context.Context) *ContextManager {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.ctx = ctx
	return instance
}

func (m *ContextManager) WithClusterLiveness(
	clusterLiveness interfaces.ClusterLivenessI,
) *ContextManager {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.clusterLiveness = clusterLiveness
	return instance
}

// WithClock returns a new instance of ContextManager with the provided clock
func (m *ContextManager) SetRealClock() *ContextManager {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.clock = clock.NewRealClock()
	return instance
}

// SetMockClock returns a new instance of ContextManager with a mock clock
func (m *ContextManager) SetMockClock() *ContextManager {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.clock = clock.NewMockClock()
	return instance
}

// GetContext returns the context held by the Manager
func (m *ContextManager) GetContext() context.Context {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.ctx
}

// GetClock returns the current time held by the Manager
func (m *ContextManager) GetClock() clock.Clock {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.clock
}

func (m *ContextManager) GetStatusMessage() *statusMessage.StatusMessage {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.statusMessage
}

// GetMockClock returns the mock time held by the Manager
func (m *ContextManager) GetMockClock() *clock.MockClock {
	m.mu.RLock()
	defer m.mu.RUnlock()
	mock, ok := m.clock.(*clock.MockClock)
	if !ok {
		log.Error().Msg("Clock is not a mock clock")
		return nil
	}
	return mock
}

func (m *ContextManager) GetClusterLiveness() (interfaces.ClusterLivenessI, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.clusterLiveness, m.clusterLiveness != nil
}
