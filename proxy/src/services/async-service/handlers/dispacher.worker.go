//go:build pro

package handlers

import (
	"lunar/async-service/config"
	"lunar/async-service/utils"
	stream_types "lunar/engine/streams/types"
	context_manager "lunar/toolkit-core/context-manager"
	protocol_async "lunar/toolkit-core/network/protocols/async"
	"net/http"

	"github.com/rs/zerolog"
)

type worker struct {
	workerID    int
	protocol    *protocol_async.Protocol
	onCloseFunc func(int)
	done        chan bool
	logger      zerolog.Logger
}

func (w *worker) work() {
	defer w.onCloseFunc(w.workerID)

	w.logger.Trace().Msg("Worker Started")
	clock := context_manager.Get().GetClock()
	asyncServiceIdle := config.GetAsyncServiceIdle()

	for {
		select {
		case <-clock.After(asyncServiceIdle):
			w.processRequests()
		case <-w.done:
			w.logger.Debug().Msg("Received done signal, exiting")
			return
		}
	}
}

func (w *worker) processRequests() {
	for w.protocol.GetQueueSize(protocol_async.QueueRequired) > 0 {
		// Gets the request from the required queue and moves it to processing
		asyncReq, err := w.protocol.MoveHead(protocol_async.QueueRequired, protocol_async.QueueProcessing)
		if err == nil {
			w.process(asyncReq)
		}
	}

	for w.protocol.GetQueueSize(protocol_async.QueueIdle) > 0 {
		// Gets the registered request from the idle queue in order to register it with the Engine.
		asyncReq, err := w.protocol.MoveHead(protocol_async.QueueIdle, protocol_async.QueueProcessing)
		if err == nil {
			w.process(asyncReq)
		}
	}
}

func (w *worker) process(asyncReq *protocol_async.RequestData) {
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
	default:
		IDLogger.Debug().Msgf("Unknown header value: %s", headerVal)
		return noOperation
	}
}
