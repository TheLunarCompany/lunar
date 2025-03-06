package lunarcontext

import (
	publictypes "lunar/engine/streams/public-types"
)

var _ publictypes.LunarContextI = &lunarContext{}

type lunarContext struct {
	globalContext        publictypes.ContextI
	transactionalContext publictypes.ContextI
	flowContext          publictypes.ContextI
}

// NewLunarContext creates a new LunarContext
func NewLunarContext(globalContext publictypes.ContextI) LunarAdminContextI {
	return &lunarContext{
		globalContext: globalContext,
	}
}

// GetGlobalContext returns the global context
func (c *lunarContext) GetGlobalContext() publictypes.ContextI {
	return c.globalContext
}

// GetFlowContext returns the flow context
func (c *lunarContext) GetFlowContext() publictypes.ContextI {
	return c.flowContext
}

// SetFlowContext sets the flow context
func (c *lunarContext) SetFlowContext(flowContext publictypes.ContextI) {
	c.flowContext = flowContext
}

// InitiateTransactionalContext initiates a new transactional context
func (c *lunarContext) InitiateTransactionalContext() {
	c.transactionalContext = NewContext()
}

// DestroyTransactionalContext destroys the transactional context
func (c *lunarContext) DestroyTransactionalContext() {
	c.transactionalContext = nil
}

// GetTransactionalContext returns the transactional context
func (c *lunarContext) GetTransactionalContext() publictypes.ContextI {
	return c.transactionalContext
}
