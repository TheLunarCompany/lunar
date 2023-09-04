package remedy

import (
	sharedActions "lunar/shared-model/actions"
	sharedConfig "lunar/shared-model/config"
)

func (accessLog *AccessLog) extractActions() []Action {
	return append(
		extractActions(accessLog.RequestActiveRemedies, reqRunResultToAction),
		extractActions(
			accessLog.ResponseActiveRemedies,
			respRunResultToAction,
		)...)
}

func (accessLog *AccessLog) extractRemedyWithActions() []RemedyWithAction {
	return append(
		extractRemedyWithAction(
			accessLog.RequestActiveRemedies,
			reqRunResultToAction,
		), extractRemedyWithAction(
			accessLog.ResponseActiveRemedies,
			respRunResultToAction,
		)...)
}

func extractActions[T any](activeRemedies map[sharedConfig.RemedyType][]T,
	convert func(T) Action,
) []Action {
	var res []Action
	for _, runResults := range activeRemedies {
		for _, runResult := range runResults {
			res = append(res, convert(runResult))
		}
	}

	return res
}

func extractRemedyWithAction[T any](
	activeRemedies map[sharedConfig.RemedyType][]T,
	convert func(T) Action,
) []RemedyWithAction {
	var res []RemedyWithAction
	for remedyType, runResults := range activeRemedies {
		for _, runResult := range runResults {
			action := convert(runResult)
			res = append(
				res,
				RemedyWithAction{Remedy: remedyType, Action: action},
			)
		}
	}

	return res
}

func reqRunResultToAction(runResult sharedActions.RemedyReqRunResult) Action {
	var res Action
	switch runResult {
	case sharedActions.ReqNoOp:
		res = ActionNoOp
	case sharedActions.ReqObtainedResponse:
		res = ActionGenerated
	case sharedActions.ReqModifiedRequest:
		res = ActionModified
	case sharedActions.ReqGenerateRequest:
		res = ActionGenerated
	}
	return res
}

func respRunResultToAction(runResult sharedActions.RemedyRespRunResult) Action {
	var res Action
	switch runResult {
	case sharedActions.RespNoOp:
		res = ActionNoOp
	case sharedActions.RespModifiedResponse:
		res = ActionModified
	}
	return res
}
