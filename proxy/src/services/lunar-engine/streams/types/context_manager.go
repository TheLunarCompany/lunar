package streamtypes

import publictypes "lunar/engine/streams/public-types"

var globalContext publictypes.ContextI

func init() {
	globalContext = NewContext()
}

type ContextManager struct {
	globalContext publictypes.ContextI
	adminContext  LunarAdminContextI
}

// NewContextManager creates a new ContextManager
func NewContextManager() *ContextManager {
	return &ContextManager{
		globalContext: globalContext,
		adminContext:  NewLunarContext(globalContext),
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
func (c *ContextManager) GetGlobalContext() publictypes.ContextI {
	return c.globalContext
}
