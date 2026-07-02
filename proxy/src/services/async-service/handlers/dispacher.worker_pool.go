//go:build pro

package handlers

import (
	"lunar/async-service/config"
	context_manager "lunar/toolkit-core/context-manager"
	protocol_async "lunar/toolkit-core/network/protocols/async"
	"sync/atomic"

	"github.com/rs/zerolog/log"
)

type WorkerPool struct {
	numWorkers     int64
	runningWorkers atomic.Int64
	protocol       *protocol_async.Protocol
	done           chan bool
}

func NewWorkerPool(numWorkers int64, protocolHandler *protocol_async.Protocol) *WorkerPool {
	return &WorkerPool{
		numWorkers: numWorkers,
		protocol:   protocolHandler,
		done:       make(chan bool),
	}
}

func (wp *WorkerPool) Start() {
	go wp.start()
}

func (wp *WorkerPool) Stop() {
	wp.done <- true
	log.Debug().Msgf("Worker pool stopped.")
}

func (wp *WorkerPool) start() {
	clock := context_manager.Get().GetClock()
	asyncServiceIdle := config.GetAsyncServiceIdle()

	for {
		select {
		case <-clock.After(asyncServiceIdle):
			wp.processRequests()
		case <-wp.done:
			log.Debug().Msg("Received done signal, exiting")
			return
		}
	}
}

func (wp *WorkerPool) processRequests() {
	for wp.protocol.GetQueueSize(protocol_async.QueueRequired) > 0 {
		if wp.runningWorkers.Load() >= wp.numWorkers {
			return
		}
		// Gets the request from the required queue and moves it to processing
		asyncReq, err := wp.protocol.MoveHead(protocol_async.QueueRequired,
			protocol_async.QueueProcessing)
		if err == nil {
			if !wp.executeTask(asyncReq) {
				return
			}
		} else {
			break
		}
	}

	for wp.protocol.GetQueueSize(protocol_async.QueueIdle) > 0 {
		if wp.runningWorkers.Load() >= wp.numWorkers {
			return
		}
		// Gets the registered request from the idle queue in order to register it with the Engine.
		asyncReq, err := wp.protocol.MoveHead(protocol_async.QueueIdle,
			protocol_async.QueueProcessing)
		if err == nil {
			if !wp.executeTask(asyncReq) {
				return
			}
		} else {
			break
		}
	}
}

func (wp *WorkerPool) executeTask(asyncReq *protocol_async.RequestData) bool {
	wp.runningWorkers.Add(1)
	workerInstance := &worker{
		protocol: wp.protocol,
		logger:   log.With().Str("request_id", asyncReq.ID).Logger(),
	}
	go func(workerInstance *worker) {
		defer wp.runningWorkers.Add(-1)
		workerInstance.Process(asyncReq)
	}(workerInstance)

	return true
}
