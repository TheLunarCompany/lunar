package actions

import (
	"lunar/engine/utils"
	sharedActions "lunar/shared-model/actions"
)

// Request Actions are prioritized as follows:
// 1. Actions which obtain a response have the highest priority.
//    No other remedies will be applied to the request after
//    a response is obtained.
// 2. Actions which modify the request have the second highest priority,
//    if there are multiple actions which modify the request, they will be
//    merged, with the later one taking precedence in the case of a conflict.
// 3. Actions which do nothing have the lowest priority.

func (action *NoOpAction) ReqPrioritize(
	other ReqLunarAction,
) ReqLunarAction {
	return other
}

func (*NoOpAction) IsEarlyReturnType() bool {
	return false
}

func (*ModifyRequestAction) IsEarlyReturnType() bool {
	return false
}

func (*ModifyHeadersAction) IsEarlyReturnType() bool {
	return false
}

func (*GenerateRequestAction) IsEarlyReturnType() bool {
	return true
}

func (*EarlyResponseAction) IsEarlyReturnType() bool {
	return true
}

func (action *ModifyHeadersAction) ReqPrioritize(
	other ReqLunarAction,
) ReqLunarAction {
	var prioritizedAction ReqLunarAction
	switch other.ReqRunResult() {

	case sharedActions.ReqObtainedResponse:
		prioritizedAction = other

	case sharedActions.ReqNoOp:
		prioritizedAction = action

	case sharedActions.ReqModifiedHeaders:
		mergedHeaders := utils.MergeHeaders(
			action.HeadersToSet, other.(*ModifyHeadersAction).HeadersToSet)

		prioritizedAction = &ModifyHeadersAction{HeadersToSet: mergedHeaders}

	case sharedActions.ReqModifiedRequest:
		mergedHeaders := utils.MergeHeaders(
			action.HeadersToSet, other.(*ModifyRequestAction).HeadersToSet)

		prioritizedAction = &ModifyRequestAction{HeadersToSet: mergedHeaders}
		if other.(*ModifyRequestAction).Path != "" {
			prioritizedAction.(*ModifyRequestAction).Path = other.(*ModifyRequestAction).Path
		}
		if other.(*ModifyRequestAction).QueryParams != "" {
			prioritizedAction.(*ModifyRequestAction).QueryParams = other.(*ModifyRequestAction).QueryParams
		}
		if other.(*ModifyRequestAction).Host != "" {
			prioritizedAction.(*ModifyRequestAction).Host = other.(*ModifyRequestAction).Host
		}
		if other.(*ModifyRequestAction).Body != "" {
			prioritizedAction.(*ModifyRequestAction).Body = other.(*ModifyRequestAction).Body
		}

	case sharedActions.ReqGenerateRequest:
		mergedHeaders := utils.MergeHeaders(
			action.HeadersToSet, other.(*GenerateRequestAction).HeadersToSet)

		prioritizedAction = &GenerateRequestAction{
			HeadersToSet:    mergedHeaders,
			HeadersToRemove: other.(*GenerateRequestAction).HeadersToRemove,
			Body:            other.(*GenerateRequestAction).Body,
		}
	}

	return prioritizedAction
}

func (action *ModifyRequestAction) ReqPrioritize(
	other ReqLunarAction,
) ReqLunarAction {
	var prioritizedAction ReqLunarAction
	switch other.ReqRunResult() {

	case sharedActions.ReqObtainedResponse:
		prioritizedAction = other

	case sharedActions.ReqNoOp:
		prioritizedAction = action

	case sharedActions.ReqModifiedHeaders:
		mergedHeaders := utils.MergeHeaders(
			action.HeadersToSet, other.(*ModifyHeadersAction).HeadersToSet)

		action.HeadersToSet = mergedHeaders
		prioritizedAction = action

	case sharedActions.ReqModifiedRequest:
		mergedHeaders := utils.MergeHeaders(
			action.HeadersToSet, other.(*ModifyRequestAction).HeadersToSet)

		prioritizedAction = &ModifyRequestAction{HeadersToSet: mergedHeaders}
		if other.(*ModifyRequestAction).Path != "" {
			prioritizedAction.(*ModifyRequestAction).Path = other.(*ModifyRequestAction).Path
		}
		if other.(*ModifyRequestAction).QueryParams != "" {
			prioritizedAction.(*ModifyRequestAction).QueryParams = other.(*ModifyRequestAction).QueryParams
		}
		if other.(*ModifyRequestAction).Host != "" {
			prioritizedAction.(*ModifyRequestAction).Host = other.(*ModifyRequestAction).Host
		}
		if other.(*ModifyRequestAction).Body != "" {
			prioritizedAction.(*ModifyRequestAction).Body = other.(*ModifyRequestAction).Body
		}

	case sharedActions.ReqGenerateRequest:
		mergedHeaders := utils.MergeHeaders(
			action.HeadersToSet, other.(*GenerateRequestAction).HeadersToSet)

		prioritizedAction = &GenerateRequestAction{
			HeadersToSet:    mergedHeaders,
			HeadersToRemove: other.(*GenerateRequestAction).HeadersToRemove,
			Body:            other.(*GenerateRequestAction).Body,
		}
	}

	return prioritizedAction
}

func (action *GenerateRequestAction) ReqPrioritize(
	other ReqLunarAction,
) ReqLunarAction {
	var prioritizedAction ReqLunarAction
	switch other.ReqRunResult() {

	case sharedActions.ReqObtainedResponse:
		prioritizedAction = other

	case sharedActions.ReqNoOp:
		prioritizedAction = action

	case sharedActions.ReqModifiedHeaders:
		mergedHeaders := utils.MergeHeaders(
			action.HeadersToSet, other.(*ModifyHeadersAction).HeadersToSet)

		prioritizedAction = &ModifyHeadersAction{
			HeadersToSet: mergedHeaders,
		}

	case sharedActions.ReqModifiedRequest:
		mergedHeaders := utils.MergeHeaders(
			action.HeadersToSet, other.(*ModifyRequestAction).HeadersToSet)

		prioritizedAction = &ModifyRequestAction{
			HeadersToSet: mergedHeaders,
		}
		if other.(*ModifyRequestAction).Path != "" {
			prioritizedAction.(*ModifyRequestAction).Path = other.(*ModifyRequestAction).Path
		}
		if other.(*ModifyRequestAction).QueryParams != "" {
			prioritizedAction.(*ModifyRequestAction).QueryParams = other.(*ModifyRequestAction).QueryParams
		}
		if other.(*ModifyRequestAction).Host != "" {
			prioritizedAction.(*ModifyRequestAction).Host = other.(*ModifyRequestAction).Host
		}
		if other.(*ModifyRequestAction).Body != "" {
			prioritizedAction.(*ModifyRequestAction).Body = other.(*ModifyRequestAction).Body
		}

	case sharedActions.ReqGenerateRequest:
		mergedHeaders := utils.MergeHeaders(
			action.HeadersToSet, other.(*GenerateRequestAction).HeadersToSet)

		headersToRemove := append(action.HeadersToRemove,
			other.(*GenerateRequestAction).HeadersToRemove...)

		prioritizedAction = &GenerateRequestAction{
			HeadersToSet:    mergedHeaders,
			HeadersToRemove: headersToRemove,
			Body:            other.(*GenerateRequestAction).Body,
		}
	}

	return prioritizedAction
}

func (action *EarlyResponseAction) ReqPrioritize(
	_ ReqLunarAction,
) ReqLunarAction {
	// TODO: Discuss if this is right - should chaining be short-circuiting?
	return action
}
