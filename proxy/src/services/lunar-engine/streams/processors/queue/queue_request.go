package processorqueue

import (
	publictypes "lunar/engine/streams/public-types"
	context_manager "lunar/toolkit-core/context-manager"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

type (
	requestState  int
	requestResult int
)

const (
	requestEnqueued requestState = iota
	requestProcessing
	requestProcessed

	requestPending requestResult = iota
	requestTimeout
	requestSuccess
)

type Request struct {
	timestamp      time.Time
	expireAt       time.Time
	priority       float64
	inProcessMutex sync.RWMutex
	apiStream      publictypes.APIStreamI
	state          requestState
	result         requestResult
	waitGroup      sync.WaitGroup
}

func NewRequest(
	priority float64,
	ttl time.Duration,
	APIStream publictypes.APIStreamI,
) *Request {
	clock := context_manager.Get().GetClock()
	req := &Request{
		priority:  priority,
		timestamp: clock.Now(),
		apiStream: APIStream,
		expireAt:  clock.Now().Add(ttl),
		state:     requestEnqueued,
		result:    requestPending,
		waitGroup: sync.WaitGroup{},
	}

	req.waitGroup.Add(1)
	return req
}

func (r *Request) GetAPIStream() publictypes.APIStreamI {
	return r.apiStream
}

func (r *Request) GetTimestamp() time.Time {
	return r.timestamp
}

func (r *Request) GetExpireAt() time.Time {
	return r.expireAt
}

func (r *Request) GetPriority() float64 {
	return r.priority
}

func (r *Request) GetID() string {
	return r.apiStream.GetID()
}

func (r *Request) StartProcessing() bool {
	r.inProcessMutex.Lock()
	defer r.inProcessMutex.Unlock()
	if r.state != requestEnqueued {
		return false
	}

	r.state = requestProcessing
	return true
}

func (r *Request) StopProcessing() {
	r.inProcessMutex.Lock()
	defer r.inProcessMutex.Unlock()

	r.state = requestEnqueued
}

func (r *Request) SetProcessedSuccess() {
	r.inProcessMutex.Lock()
	defer r.inProcessMutex.Unlock()

	r.result = requestSuccess
	r.state = requestProcessed

	log.Trace().Msgf("Request %s is processed successfully", r.GetID())
	r.setSignal()
}

func (r *Request) SetProcessedTimeout() bool {
	r.inProcessMutex.Lock()
	defer r.inProcessMutex.Unlock()

	r.result = requestTimeout
	r.state = requestProcessed

	log.Trace().Msgf("Request %s is timed out", r.GetID())
	r.setSignal()
	return true
}

func (r *Request) Wait() bool {
	r.waitGroup.Wait()
	return r.result == requestSuccess
}

func (r *Request) setSignal() {
	r.waitGroup.Done()
}
