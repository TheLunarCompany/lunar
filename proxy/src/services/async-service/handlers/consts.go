//go:build pro

package handlers

const (
	QueryParamSeqID     = "sequence_id"
	HeaderAsyncLocation = "location"
	RetrievePath        = "/retrieve"
	RegisterPath        = "/"

	asyncServiceResponseNotAllowedHeaderName = "X-Lunar-Async-State"
	asyncServiceResponseRegister             = "register"
	asyncServiceResponseBlocked              = "blocked"
	asyncServiceResponseError                = "error"
)

type workerResult int

const (
	addToIdle workerResult = iota
	addToPending
	addToErrors
	noOperation
	addResponse
)
