package streamtypes

type ContextI interface {
	Set(key string, value interface{}) error
	Get(key string) (interface{}, error)
	Pop(key string) (interface{}, error)
}

type LunarContextI interface {
	GetGlobalContext() ContextI
	GetFlowContext() ContextI
	GetTransactionalContext() ContextI
}

type LunarAdminContextI interface {
	LunarContextI

	SetFlowContext(flowContext ContextI)
	InitiateTransactionalContext()
	DestroyTransactionalContext()
}
