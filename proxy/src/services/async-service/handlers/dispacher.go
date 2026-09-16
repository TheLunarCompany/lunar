//go:build pro

package handlers

import (
	"lunar/async-service/config"
	protocol_async "lunar/toolkit-core/network/protocols/async"

	"github.com/rs/zerolog/log"
)

type Dispatcher struct {
	workers *WorkerPool
}

func NewDispatcher(protocolHandler *protocol_async.Protocol) *Dispatcher {
	return &Dispatcher{
		workers: NewWorkerPool(config.GetAsyncServiceWorkers(), protocolHandler),
	}
}

func (d *Dispatcher) Start() {
	log.Debug().Msgf("Dispatcher started with %d workers", config.GetAsyncServiceWorkers())
	d.workers.Start()
}

func (d *Dispatcher) Stop() {
	log.Debug().Msgf("Dispatcher stopped")
	d.workers.Stop()
}
