package streamtypes

var _ LunarContextI = &lunarContext{}

type lunarContext struct {
	globalContext        ContextI
	transactionalContext ContextI
	flowContext          ContextI
}

// NewLunarContext creates a new LunarContext
func NewLunarContext(globalContext ContextI) LunarAdminContextI {
	return &lunarContext{
		globalContext: globalContext,
	}
}

// GetGlobalContext returns the global context
func (c *lunarContext) GetGlobalContext() ContextI {
	return c.globalContext
}

// GetFlowContext returns the flow context
func (c *lunarContext) GetFlowContext() ContextI {
	return c.flowContext
}

// SetFlowContext sets the flow context
func (c *lunarContext) SetFlowContext(flowContext ContextI) {
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
func (c *lunarContext) GetTransactionalContext() ContextI {
	return c.transactionalContext
}
