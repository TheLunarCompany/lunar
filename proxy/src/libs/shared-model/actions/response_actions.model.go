package actions

import (
	"fmt"
	"strings"
)

type RemedyRespRunResult int

const (
	RespNoOp RemedyRespRunResult = iota
	RespModifiedResponse
)

func (runResult RemedyRespRunResult) String() string {
	var res string
	switch runResult {
	case RespNoOp:
		res = "no_op"
	case RespModifiedResponse:
		res = "modified_response"
	}
	return res
}

func ParseRemedyRespRunResult(raw string) (RemedyRespRunResult, error) {
	var res RemedyRespRunResult
	raw = strings.TrimSpace(strings.ToLower(raw))
	switch raw {
	case RespNoOp.String():
		res = RespNoOp
	case RespModifiedResponse.String():
		res = RespModifiedResponse
	default:
		return RespNoOp, fmt.Errorf(
			"RemedyReqRunResult %v is not recognized",
			raw,
		)
	}
	return res, nil
}
