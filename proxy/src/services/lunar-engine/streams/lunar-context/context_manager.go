package lunarcontext

import (
	publicTypes "lunar/engine/streams/public-types"
	"sync"
)

var (
	globalContext publicTypes.ContextI
	once          sync.Once
)

type ContextManager struct {
	globalContext publicTypes.ContextI
	adminContext  LunarAdminContextI
}

// NewContextManager creates a new ContextManager
func NewContextManager() *ContextManager {
	ctx := singleInstanceOfGlobalAndSharedContext()

	return &ContextManager{
		globalContext: ctx,
		adminContext:  NewLunarContext(ctx),
	}
}

// WithFlowContext sets the flow context
func (c *ContextManager) WithFlowContext() *ContextManager {
	c.adminContext.SetFlowContext(NewContext())
	return c
}

// WithTransactionalContext sets the transactional context
func (c *ContextManager) WithTransactionalContext() *ContextManager {
	c.adminContext.InitiateTransactionalContext()
	return c
}

// DestroyTransactionalContext destroys the lunar context
func (c *ContextManager) DestroyTransactionalContext() {
	c.adminContext.DestroyTransactionalContext()
}

// GetLunarContext returns the lunar context
func (c *ContextManager) GetLunarContext() LunarAdminContextI {
	return c.adminContext
}

// GetGlobalContext returns the global context
func (c *ContextManager) GetGlobalContext() publicTypes.ContextI {
	return c.globalContext
}

// GetTransactionalContext returns the transactional context
func (c *ContextManager) GetTransactionalContext() publicTypes.ContextI {
	return c.adminContext.GetTransactionalContext()
}

// GetFlowContext returns the flow context
func (c *ContextManager) GetFlowContext() publicTypes.ContextI {
	return c.adminContext.GetFlowContext()
}

// TODO: Make this function to use global as shared state
// singleInstanceOfGlobalContext returns a single instance of the global context
func singleInstanceOfGlobalAndSharedContext() publicTypes.ContextI {
	once.Do(func() {
		globalContext = NewContext()
	})
	return globalContext
}
