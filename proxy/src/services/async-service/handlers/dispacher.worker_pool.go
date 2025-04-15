//go:build pro

package handlers

import (
	protocol_async "lunar/toolkit-core/network/protocols/async"
	"sync"

	"github.com/rs/zerolog/log"
)

type WorkerPool struct {
	numWorkers int
	protocol   *protocol_async.Protocol
	done       chan bool
	wg         *sync.WaitGroup
}

func NewWorkerPool(numWorkers int, protocolHandler *protocol_async.Protocol) *WorkerPool {
	return &WorkerPool{
		numWorkers: numWorkers,
		protocol:   protocolHandler,
		done:       make(chan bool),
		wg:         &sync.WaitGroup{},
	}
}

func (wp *WorkerPool) Start() {
	for workerID := 0; workerID < wp.numWorkers; workerID++ {
		wp.wg.Add(1)
		worker := &worker{
			workerID:    workerID,
			protocol:    wp.protocol,
			done:        wp.done,
			onCloseFunc: wp.onWorkerClose,
			logger:      log.With().Int("worker", workerID).Logger(),
		}

		go worker.work()
	}
}

func (wp *WorkerPool) Stop() {
	for i := 0; i < wp.numWorkers; i++ {
		wp.done <- true
	}
	wp.wg.Wait()
	log.Debug().Msgf("Worker pool stopped.")
}

func (wp *WorkerPool) onWorkerClose(workerID int) {
	log.Debug().Msgf("Worker %d closed", workerID)
	wp.wg.Done()
}
