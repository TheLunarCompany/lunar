//go:build pro

package handlers

const (
	QueryParamSeqID        = "sequence_id"
	HeaderAsyncLocation    = "location"
	RetrievePath           = "/retrieve"
	RegisterPath           = "/"
	AsyncServiceHeaderName = "X-Lunar-Async"

	asyncServiceFlowIndicatorHeaderName      = "X-Lunar-Async-Flow"
	asyncServiceResponseNotAllowedHeaderName = "X-Lunar-Async-State"
	asyncServiceResponseRegister             = "register"
	asyncServiceResponseBlocked              = "blocked"
	asyncServiceResponseError                = "error"
	asyncServiceResponseRetry                = "retry"
)

type workerResult int

const (
	addToIdle workerResult = iota
	addToPending
	addToErrors
	noOperation
	addResponse
)
