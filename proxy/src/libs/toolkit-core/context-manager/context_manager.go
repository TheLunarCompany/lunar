package contextmanager

import (
	"context"
	"lunar/toolkit-core/clock"
	statusMessage "lunar/toolkit-core/status-message"
	"sync"

	"github.com/rs/zerolog/log"
)

// Manager is the singleton that holds the context and clock
type ContextManager struct {
	ctx           context.Context
	clock         clock.Clock
	statusMessage *statusMessage.StatusMessage
}

var (
	instance *ContextManager
	once     sync.Once
)

// Get returns the singleton instance of ContextManager
func Get() *ContextManager {
	if instance == nil {
		initContextManager(context.Background(), clock.NewRealClock())
	}
	return instance
}

// WithContext returns a new instance of ContextManager with the provided context
func (m *ContextManager) WithContext(ctx context.Context) *ContextManager {
	m.ctx = ctx
	return instance
}

// WithClock returns a new instance of ContextManager with the provided clock
func (m *ContextManager) SetRealClock() *ContextManager {
	m.clock = clock.NewRealClock()
	return instance
}

// SetMockClock returns a new instance of ContextManager with a mock clock
func (m *ContextManager) SetMockClock() *ContextManager {
	m.clock = clock.NewMockClock()
	return instance
}

// GetContext returns the context held by the Manager
func (m *ContextManager) GetContext() context.Context {
	return m.ctx
}

// GetClock returns the current time held by the Manager
func (m *ContextManager) GetClock() clock.Clock {
	return m.clock
}

func (m *ContextManager) GetStatusMessage() statusMessage.StatusMessage {
	return *m.statusMessage
}

// GetMockClock returns the mock time held by the Manager
func (m *ContextManager) GetMockClock() *clock.MockClock {
	mock, ok := m.clock.(*clock.MockClock)
	if !ok {
		log.Error().Msg("Clock is not a mock clock")
		return nil
	}
	return mock
}

// initContextManager initializes the singleton instance of ContextManager
func initContextManager(ctx context.Context, clk clock.Clock) {
	once.Do(func() {
		instance = &ContextManager{
			ctx:           ctx,
			clock:         clk,
			statusMessage: statusMessage.NewStatusMessage(),
		}
	})
}
