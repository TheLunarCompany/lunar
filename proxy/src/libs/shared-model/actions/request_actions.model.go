package actions

import (
	"fmt"
	"strings"
)

type RemedyReqRunResult int

const (
	ReqNoOp RemedyReqRunResult = iota
	ReqObtainedResponse
	ReqModifiedRequest
	ReqModifiedHeaders
	ReqGenerateRequest
)

func (runResult RemedyReqRunResult) String() string {
	var res string
	switch runResult {
	case ReqNoOp:
		res = "no_op"
	case ReqObtainedResponse:
		res = "obtained_response"
	case ReqModifiedRequest:
		res = "modified_request"
	case ReqModifiedHeaders:
		res = "modified_headers"
	case ReqGenerateRequest:
		res = "generate_request"
	}
	return res
}

func ParseRemedyReqRunResult(raw string) (RemedyReqRunResult, error) {
	var res RemedyReqRunResult
	raw = strings.TrimSpace(strings.ToLower(raw))
	switch raw {
	case ReqNoOp.String():
		res = ReqNoOp
	case ReqObtainedResponse.String():
		res = ReqObtainedResponse
	case ReqModifiedRequest.String():
		res = ReqModifiedRequest
	case ReqModifiedHeaders.String():
		res = ReqModifiedHeaders
	default:
		return ReqNoOp, fmt.Errorf(
			"RemedyReqRunResult %v is not recognized",
			raw,
		)
	}
	return res, nil
}
