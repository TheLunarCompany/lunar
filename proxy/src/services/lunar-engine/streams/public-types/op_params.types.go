package publictypes

import "regexp"

type (
	OperationParamType string
	OpEvalRegexFunc    func(string, *regexp.Regexp, bool) bool
	OpEvalFloat64Func  func(float64, float64, bool) bool
	OpEvalStringFunc   func(string, string, bool) bool
	OpEvalBoolFunc     func(bool, bool, bool) bool
)

type OpEvalFunctions struct {
	OpEvalFloat64Func OpEvalFloat64Func
	OpEvalStringFunc  OpEvalStringFunc
	OpEvalBoolFunc    OpEvalBoolFunc
	OpEvalRegexFunc   OpEvalRegexFunc
}

const (
	OpParamEq        OperationParamType = "eq"
	OpParamNeq       OperationParamType = "neq"
	OpParamGt        OperationParamType = "gt"
	OpParamGte       OperationParamType = "gte"
	OpParamLt        OperationParamType = "lt"
	OpParamLte       OperationParamType = "lte"
	OpParamExists    OperationParamType = "exists"
	OpParamNotExists OperationParamType = "not_exists"
	OpParamRegex     OperationParamType = "regex"
)

func (o OperationParamType) String() string {
	return string(o)
}

func (o OperationParamType) IsValid() bool {
	switch o {
	case OpParamEq, OpParamNeq, OpParamGt, OpParamGte, OpParamLt,
		OpParamLte, OpParamExists, OpParamNotExists, OpParamRegex:
		return true
	}
	return false
}

func (o OperationParamType) GetEvalFunc() *OpEvalFunctions {
	opEvalFunctions := &OpEvalFunctions{}

	switch o {
	case OpParamEq:
		opEvalFunctions.OpEvalStringFunc = o.funcOpEq
	case OpParamNeq:
		opEvalFunctions.OpEvalStringFunc = o.funcOpNeq
	case OpParamGt:
		opEvalFunctions.OpEvalFloat64Func = o.funcOpGt
	case OpParamGte:
		opEvalFunctions.OpEvalFloat64Func = o.funcOpGte
	case OpParamLt:
		opEvalFunctions.OpEvalFloat64Func = o.funcOpLt
	case OpParamLte:
		opEvalFunctions.OpEvalFloat64Func = o.funcOpLte
	case OpParamExists:
		opEvalFunctions.OpEvalStringFunc = o.funcOpExists
	case OpParamNotExists:
		opEvalFunctions.OpEvalStringFunc = o.funcOpNotExists
	case OpParamRegex:
		opEvalFunctions.OpEvalRegexFunc = o.funcOpRegex
	}

	return opEvalFunctions
}

func (o OperationParamType) funcOpEq(headerValue, paramValue string, exists bool) bool {
	if !exists {
		return false
	}
	return headerValue == paramValue
}

func (o OperationParamType) funcOpNeq(headerValue, paramValue string, exists bool) bool {
	if !exists {
		return false
	}
	return headerValue != paramValue
}

func (o OperationParamType) funcOpGt(headerValue, paramValue float64, exists bool) bool {
	if !exists {
		return false
	}
	return headerValue > paramValue
}

func (o OperationParamType) funcOpGte(headerValue, paramValue float64, exists bool) bool {
	if !exists {
		return false
	}
	return headerValue >= paramValue
}

func (o OperationParamType) funcOpLt(headerValue, paramValue float64, exists bool) bool {
	if !exists {
		return false
	}
	return headerValue < paramValue
}

func (o OperationParamType) funcOpLte(headerValue, paramValue float64, exists bool) bool {
	if !exists {
		return false
	}
	return headerValue <= paramValue
}

func (o OperationParamType) funcOpExists(_, _ string, exists bool) bool {
	return exists
}

func (o OperationParamType) funcOpNotExists(_, _ string, exists bool) bool {
	return !exists
}

func (o OperationParamType) funcOpRegex(
	headerValue string,
	paramValue *regexp.Regexp,
	exists bool,
) bool {
	if !exists {
		return false
	}
	return paramValue.MatchString(headerValue)
}
