package processorqueue

import (
	"container/heap"
	"lunar/engine/streams/processors/utils"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	clock "lunar/toolkit-core/clock"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

const (
	groupByHeader = "priority_group_by_header"
	quotaParam    = "quota_id"
	queueSize     = "queue_size"
	queueTTL      = "ttl_seconds"
	groupsParam   = "priority_groups"
)

type queueProcessor struct {
	quotaID       string
	name          string
	mutex         sync.RWMutex
	queue         *PriorityQueue
	queueTTL      time.Duration
	maxQueueSize  int64
	groupByHeader string
	groups        map[string]int64
	clock         clock.Clock
	logger        zerolog.Logger
	metaData      *streamtypes.ProcessorMetaData
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	proc := &queueProcessor{
		name:     metaData.Name,
		metaData: metaData,
		groups:   make(map[string]int64),
		clock:    clock.NewRealClock(),
		queue:    &PriorityQueue{},
	}

	if err := proc.init(); err != nil {
		return nil, err
	}

	for key, value := range proc.groups {
		log.Trace().Msgf("Group %s has priority %d", key, value)
	}

	heap.Init(proc.queue)
	go proc.process()

	return proc, nil
}

func (p *queueProcessor) GetName() string {
	return p.name
}

func (p *queueProcessor) Execute(
	APIStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	p.logger.Trace().Str("requestID", APIStream.GetRequest().GetID()).
		Str("quotaID", p.quotaID).
		Msg("Processing request")
	priority := p.extractPriority(APIStream.GetRequest())
	req := NewRequest(
		APIStream.GetRequest().GetID(),
		priority, clock.NewRealClock(),
		APIStream,
	)

	canProcess, err := p.enqueue(req)
	if err != nil {
		p.logger.Error().Err(err).
			Msg("failed enqueueing request")
		return streamtypes.ProcessorIO{
			Type: publictypes.StreamTypeAny,
			Name: "allowed",
		}, err
	}

	if canProcess {
		return streamtypes.ProcessorIO{
			Type: publictypes.StreamTypeAny,
			Name: "allowed",
		}, nil
	}

	p.logger.Trace().Str("requestID", APIStream.GetRequest().GetID()).
		Msgf("request cannot be processed, will return early response")

	return streamtypes.ProcessorIO{
		Type: publictypes.StreamTypeAny,
		Name: "blocked",
	}, nil
}

func (p *queueProcessor) enqueue(req *Request) (bool, error) {
	p.logger.Trace().Str("requestID", req.ID).
		Int64("priority", req.priority).
		Msg("Trying to enqueue")

	allowed, err := p.checkIfAllowed(req)
	if err != nil {
		p.logger.Error().Err(err).
			Msg("failed to check if request is allowed")
		// We close the request channel to avoid memory leaks, as the request will not be processed
		req.CloseChan()
		return allowed, err
	}

	if allowed {
		p.logger.Trace().Str("requestID", req.ID).
			Msg("Request allowed to be processed immediately")
		// We close the request channel to avoid memory leaks, as the request will not be processed
		req.CloseChan()
		return true, nil
	}

	if !p.enqueueIfSlotAvailable(req) {
		// We close the request channel to avoid memory leaks, as the request will not be processed
		req.CloseChan()
		return false, nil
	}

	p.logger.Trace().Str("requestID", req.ID).
		Msgf("Sending request to be processed in queue")

	// Wait until request is processed or TTL expires
	for {
		select {
		case <-req.doneCh:
			p.logger.Trace().
				Str("requestID", req.ID).
				Msgf("Request processing completed")
			return true, nil

		case <-p.clock.After(p.queueTTL):
			p.logger.Trace().Str("requestID", req.ID).
				Msgf("Request TTLed (now: %+v, ttl: %+v)", p.clock.Now(), p.queueTTL)
			return false, nil
		}
	}
}

func (p *queueProcessor) getNextProcessTime() time.Duration {
	if p.metaData.Resources != nil {
		quota, err := p.metaData.Resources.GetQuota(p.quotaID, "")
		if err == nil {
			nextResetIn := quota.ResetIn()
			return nextResetIn
		}
	}
	return time.Second
}

func (p *queueProcessor) process() {
	for {
		<-p.clock.After(p.getNextProcessTime())
		p.mutex.Lock()
		p.processQueueItems()
		p.mutex.Unlock()
	}
}

func (p *queueProcessor) processQueueItems() {
	for p.queue.Len() > 0 {
		req, valid := heap.Pop(p.queue).(*Request)

		if !valid {
			p.logger.Error().
				Msg("Could not cast priorityQueue item as Request, " +
					"will not process")
			continue
		}

		p.logger.Trace().
			Str("requestID", req.ID).
			Msgf("Attempt to process queued request")

		allowed, err := p.checkIfAllowed(req)
		if !allowed {
			// Re-enqueue request as it was blocked and we cant continue with this quota ID until it resets
			p.logger.Trace().Err(err).Str("requestID", req.ID).Msgf("Request blocked, re-enqueueing")
			heap.Push(p.queue, req)
			return
		}

		select {
		case req.doneCh <- struct{}{}:
			// We close the request channel to avoid memory leaks, as the request has been processed
			req.CloseChan()
			p.logger.Trace().Str("requestID", req.ID).
				Msgf("notified successful request processing to req.doneCh")
		default:
			p.logger.Trace().Str("requestID", req.ID).
				Msgf("req.doneCh already closed")
		}
		p.logger.Trace().Msgf("request %s processed in queue", req.ID)
	}
}

// If priority is not defined/find, it will default to 0,
// which is the highest priority.
func (p *queueProcessor) extractPriority(
	onRequest publictypes.TransactionI,
) int64 {
	if p.groupByHeader == "" {
		return 0
	}
	groupName, found := onRequest.GetHeaders()[p.groupByHeader]
	if !found {
		p.logger.Trace().Str("requestID", onRequest.GetID()).
			Str("groupByHeader", p.groupByHeader).
			Msg("Priority header not found, defaulting to 0")
		return 0
	}
	reqPriority, found := p.groups[groupName]
	if !found {
		p.logger.Trace().Str("requestID", onRequest.GetID()).
			Str("groupByHeader", p.groupByHeader).
			Msg("Priority not found, defaulting to 0")
		return 0
	}
	p.logger.Trace().Str("requestID", onRequest.GetID()).
		Str("groupByHeader", p.groupByHeader).
		Msg("Extracting priority")
	return reqPriority
}

func (p *queueProcessor) checkIfAllowed(req *Request) (bool, error) {
	quota, err := p.metaData.Resources.GetQuota(p.quotaID, req.APIStream.GetID())
	if err != nil {
		return false, err
	}
	return quota.Allowed(req.APIStream)
}

func (p *queueProcessor) init() error {
	if err := utils.ExtractStrParam(p.metaData.Parameters,
		quotaParam,
		&p.quotaID); err != nil {
		return err
	}

	if err := utils.ExtractMapOfInt64Param(p.metaData.Parameters,
		groupsParam,
		p.groups); err != nil {
		return err
	}

	if err := utils.ExtractStrParam(p.metaData.Parameters,
		groupByHeader, &p.groupByHeader); err != nil {
		return err
	}

	if err := utils.ExtractInt64Param(p.metaData.Parameters,
		queueSize, &p.maxQueueSize); err != nil {
		return err
	}

	if err := utils.ExtractDurationInSecParam(
		p.metaData.Parameters, queueTTL, &p.queueTTL); err != nil {
		return err
	}

	p.logger = log.Logger.With().
		Str("processor", "queueProcessor").
		Str("quotaID", p.quotaID).Logger()
	return nil
}

func (p *queueProcessor) enqueueIfSlotAvailable(req *Request) bool {
	p.mutex.Lock()
	defer p.mutex.Unlock()

	if int64(p.queue.Len()) > p.maxQueueSize {
		p.logger.Trace().Str("requestID", req.ID).Msg("Slot not available, dropping request")
		return false
	}

	p.logger.Trace().Str("requestID", req.ID).Msg("Slot available, enqueuing")
	heap.Push(p.queue, req)
	return true
}
