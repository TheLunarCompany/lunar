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
			w.checkForRequestInQueue()
		case <-w.done:
			w.logger.Debug().Msg("Received done signal, exiting")
			return
		}
	}
}

func (w *worker) checkForRequestInQueue() {
	asyncReq, err := w.getRequestToProcess()
	if err != nil {
		w.logger.Trace().Err(err).Msg("Error getting request to process")
		return
	}

	IDLogger := w.logger.With().Str("request_id", asyncReq.ID).Logger()

	if !asyncReq.Initialized {
		IDLogger.Trace().Msg("asyncReq not initialized")
		return
	}

	defer func() {
		if err := w.protocol.RemoveRequestFromProcessingQueue(asyncReq); err != nil {
			IDLogger.Debug().Err(err).Msg("Error removing request from processing queue")
		}
	}()

	result := w.processJob(asyncReq, IDLogger)
	switch result {
	case addToIdle:
		if _, err := w.protocol.MoveHead(asyncReq.QueueType, protocol_async.QueueIdle); err != nil {
			IDLogger.Debug().Err(err).Msg("Error adding request to idle queue")
			return
		}
	case addToPending:
		if _, err := w.protocol.MoveHead(asyncReq.QueueType, protocol_async.QueuePending); err != nil {
			IDLogger.Debug().Err(err).Msg("Error adding request to pending queue")
		}
	case addToErrors:
		// TODO: do we want to have an error queue?
		// w.protocol.AddRequestToErrorQueue(asyncReq)
		IDLogger.Trace().Msg("Added request to error queue")
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
	IDLogger.Debug().Msgf("Processing request %s", asyncReq.ID)

	response, err := utils.MakeRequest(request)
	if err != nil {
		IDLogger.Debug().Err(err).Msg("Error making request")
		return addToIdle
	}

	if response == nil {
		IDLogger.Debug().Msg("Response is nil")
		return addToErrors
	} else if response.ID == "" {
		response.ID = asyncReq.ID
		response.SequenceID = asyncReq.ID
	}

	operation := w.getOperationBasedOnResponse(response, IDLogger)
	if operation == addResponse {
		if err := w.protocol.StoreResponse(response); err != nil {
			IDLogger.Debug().Err(err).Msg("Error storing response")
			return addToErrors
		}
		if err := w.protocol.RemoveRequestFromStorage(asyncReq.ID); err != nil {
			IDLogger.Debug().Err(err).Msg("Error removing request from storage")
			return addToErrors
		}
	}

	IDLogger.Trace().Msg("Finished processing.")

	return operation
}

func (w *worker) prepareRequest(
	asyncReq *protocol_async.RequestData,
	IDLogger zerolog.Logger,
) *stream_types.OnRequest {
	request, err := w.protocol.GetRequestByID(asyncReq.ID)
	if err != nil {
		IDLogger.Debug().Err(err).Msgf("Error getting request by ID: %s", asyncReq.ID)
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
		return addToIdle
	case asyncServiceResponseError:
		return addToIdle
	default:
		IDLogger.Debug().Msgf("Unknown header value: %s", headerVal)
		return noOperation
	}
}

func (w *worker) getRequestToProcess() (*protocol_async.RequestData, error) {
	var err error
	asyncReq := &protocol_async.RequestData{}

	if w.protocol.GetQueueSize(protocol_async.QueueRequired) > 0 {
		asyncReq, err = w.protocol.MoveHead(protocol_async.QueueRequired, protocol_async.QueueProcessing)
	} else if w.protocol.GetQueueSize(protocol_async.QueueIdle) > 0 {
		asyncReq, err = w.protocol.MoveHead(protocol_async.QueueIdle, protocol_async.QueueProcessing)
	}

	return asyncReq, err
}
