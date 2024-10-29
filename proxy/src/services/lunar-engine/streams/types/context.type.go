package streamtypes

import publictypes "lunar/engine/streams/public-types"

type LunarAdminContextI interface {
	publictypes.LunarContextI

	SetFlowContext(flowContext publictypes.ContextI)
	InitiateTransactionalContext()
	DestroyTransactionalContext()
}
