//go:build pro

package handlers

import (
	"lunar/async-service/utils"
	stream_types "lunar/engine/streams/types"
	protocol_async "lunar/toolkit-core/network/protocols/async"
	"net/http"

	"github.com/rs/zerolog"
)

type worker struct {
	protocol *protocol_async.Protocol
	logger   zerolog.Logger
}

func (w *worker) Process(asyncReq *protocol_async.RequestData) {
	var err error
	IDLogger := w.logger.With().Str("request_id", asyncReq.ID).Logger()

	if !asyncReq.Initialized {
		IDLogger.Trace().Msg("asyncReq not initialized")
		return
	}

	defer func() {
		if err = w.protocol.RemoveRequestFromProcessingQueue(asyncReq); err != nil {
			IDLogger.Debug().Err(err).Msg("Error removing request from processing queue")
		}
	}()

	result := w.processJob(asyncReq, IDLogger)

	switch result {
	case addToIdle:
		if err = w.protocol.AddRequestToIdleQueue(asyncReq); err != nil {
			IDLogger.Trace().Err(err).Msg("Error adding request to idle queue")
		}
	case addToPending:
		if err = w.protocol.AddRequestToPendingQueue(asyncReq); err != nil {
			IDLogger.Trace().Err(err).Msg("Error adding request to pending queue")
		}
	case addToErrors:
		// TODO: do we want to have an error queue?
		// w.protocol.AddRequestToErrorQueue(asyncReq)
		return
	case noOperation:
		return
	case addResponse:
		return
	}
}

func (w *worker) processJob(
	asyncReq *protocol_async.RequestData,
	IDLogger zerolog.Logger,
) workerResult {
	request := w.prepareRequest(asyncReq, IDLogger)

	response, err := utils.MakeRequest(request)
	if err != nil {
		IDLogger.Trace().Err(err).Msg("Error making request")
		return addToIdle
	}

	if response == nil {
		IDLogger.Trace().Msg("Response is nil")
		return addToErrors
	} else if response.ID == "" {
		response.ID = asyncReq.ID
		response.SequenceID = asyncReq.ID
	}

	operation := w.getOperationBasedOnResponse(response, IDLogger)
	if operation == addResponse {
		err = w.onResponse(asyncReq, response)
		if err != nil {
			IDLogger.Trace().Err(err).Msg("Error on response")
			return addToErrors
		}
	}

	IDLogger.Trace().Msg("Finished processing.")

	return operation
}

func (w *worker) onResponse(
	asyncReq *protocol_async.RequestData,
	response *stream_types.OnResponse,
) error {
	if err := w.protocol.StoreResponse(response); err != nil {
		return err
	}

	return w.protocol.RemoveRequestFromStorage(asyncReq.ID)
}

func (w *worker) prepareRequest(
	asyncReq *protocol_async.RequestData,
	IDLogger zerolog.Logger,
) *stream_types.OnRequest {
	request, err := w.protocol.GetRequestByID(asyncReq.ID)
	if err != nil {
		IDLogger.Trace().Err(err).Msgf("Error getting request by ID: %s", asyncReq.ID)
		return nil
	}

	if request == nil {
		IDLogger.Trace().Msg("Request not found")
		return nil
	}

	return request
}

func (w *worker) getOperationBasedOnResponse(
	response *stream_types.OnResponse,
	IDLogger zerolog.Logger,
) workerResult {
	if response.Status != http.StatusAccepted {
		return addResponse
	}

	headerVal, found := response.Headers[asyncServiceResponseNotAllowedHeaderName]
	if !found {
		return addResponse
	}

	switch headerVal {
	case asyncServiceResponseRegister:
		return addToPending
	case asyncServiceResponseBlocked:
		return addToPending
	case asyncServiceResponseError:
		return addToIdle
	case asyncServiceResponseRetry:
		return addToIdle
	default:
		IDLogger.Debug().Msgf("Unknown header value: %s", headerVal)
		return noOperation
	}
}
