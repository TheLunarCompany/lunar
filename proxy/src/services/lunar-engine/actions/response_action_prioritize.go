package actions

import (
	"lunar/engine/utils"
	sharedActions "lunar/shared-model/actions"
)

// Response Actions are prioritized as follows:
// 1. Actions which modify the response have the highest priority,
//    if there are multiple actions which modify the response, they will be
//    merged, with the later one taking precedence in the case of a conflict.
// 2. Actions which do nothing have the lowest priority.

func (*NoOpAction) RespPrioritize(other RespLunarAction) RespLunarAction {
	return other
}

func (action *ModifyResponseAction) RespPrioritize(
	other RespLunarAction,
) RespLunarAction {
	var prioritizedAction RespLunarAction
	switch other.RespRunResult() {

	case sharedActions.RespNoOp:
		prioritizedAction = action

	case sharedActions.RespModifiedResponse:
		mergedHeaders := utils.MergeHeaders(
			action.HeadersToSet, other.(*ModifyResponseAction).HeadersToSet)

		prioritizedAction = &ModifyResponseAction{HeadersToSet: mergedHeaders}
	}

	return prioritizedAction
}
