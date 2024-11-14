package processorqueue

import (
	"container/heap"
	"context"
	"fmt"
	"lunar/engine/streams/processors/utils"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	clock "lunar/toolkit-core/clock"
	"lunar/toolkit-core/otel"
	"sync"
	"time"

	lunar_metrics "lunar/engine/metrics"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const (
	groupByHeader         = "priority_group_by_header"
	quotaParam            = "quota_id"
	queueSize             = "queue_size"
	queueTTL              = "ttl_seconds"
	groupsParam           = "priority_groups"
	requestsInQueueMetric = "lunar_processor_queue_requests_in_queue"
	requestsHandledMetric = "lunar_processor_queue_requests_handled"
)

type queueProcessor struct {
	quotaID                 string
	name                    string
	mutex                   sync.RWMutex
	queue                   *PriorityQueue
	queueTTL                time.Duration
	maxQueueSize            int64
	groupByHeader           string
	groups                  map[string]int64
	clock                   clock.Clock
	logger                  zerolog.Logger
	requestsInQueueMeterObj metric.Int64UpDownCounter
	requestsHandledMeterObj metric.Int64Counter
	labelManager            *lunar_metrics.LabelManager
	metaData                *streamtypes.ProcessorMetaData
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	proc := &queueProcessor{
		name:         metaData.Name,
		metaData:     metaData,
		groups:       make(map[string]int64),
		clock:        metaData.GetClock(),
		queue:        &PriorityQueue{},
		labelManager: lunar_metrics.NewLabelManager(metaData.GetMetricLabels()),
	}

	if err := proc.init(); err != nil {
		return nil, err
	}

	for key, value := range proc.groups {
		log.Trace().Msgf("Group %s has priority %d", key, value)
	}

	err := proc.initializeMetrics()
	if err != nil {
		log.Error().Err(err).Msgf("failed to initialize metrics for %s", metaData.Name)
		proc.metaData.Metrics.Enabled = false
	}

	heap.Init(proc.queue)
	go proc.process()

	return proc, nil
}

func (p *queueProcessor) GetName() string {
	return p.name
}

func (p *queueProcessor) Execute(
	flowName string,
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	p.logger.Trace().Str("requestID", apiStream.GetRequest().GetID()).
		Str("quotaID", p.quotaID).
		Msg("Processing request")

	canProcess, err := p.enqueue(flowName, apiStream)
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

	p.logger.Trace().Str("requestID", apiStream.GetRequest().GetID()).
		Msgf("request cannot be processed, will return early response")

	return streamtypes.ProcessorIO{
		Type: publictypes.StreamTypeAny,
		Name: "blocked",
	}, nil
}

func (p *queueProcessor) enqueue(flowName string, apiStream publictypes.APIStreamI) (bool, error) {
	priority := p.extractPriority(apiStream.GetRequest())
	req := NewRequest(
		apiStream.GetRequest().GetID(),
		priority,
		clock.NewRealClock(),
		apiStream,
	)

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
	p.updateMetrics(flowName, apiStream, req, true, false)
	for {
		select {
		case <-req.doneCh:
			p.logger.Trace().
				Str("requestID", req.ID).
				Msgf("Request processing completed")
			p.updateMetrics(flowName, apiStream, req, false, false)
			return true, nil

		case <-p.clock.After(p.queueTTL):
			p.logger.Trace().Str("requestID", req.ID).
				Msgf("Request TTLed (now: %+v, ttl: %+v)", p.clock.Now(), p.queueTTL)
			p.updateMetrics(flowName, apiStream, req, false, true)
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
			p.logger.Trace().
				Err(err).
				Str("requestID", req.ID).
				Msgf("Request blocked, re-enqueueing")
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
		p.logger.Trace().Str("requestID", onRequest.GetID()).
			Msg("Priority header not initialized, defaulting to 0")
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
	quota, err := p.metaData.Resources.GetQuota(
		p.quotaID,
		req.APIStream.GetID(),
	)
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

	if _, err := p.metaData.Resources.GetQuota(p.quotaID, ""); err != nil {
		return fmt.Errorf(
			"quota %s not found for processor %s: %w",
			p.quotaID,
			p.name,
			err,
		)
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

	p.logger.Trace().Str("requestID", req.ID).
		Int("QueueCurrentSize", p.queue.Len()).
		Int64("MaxQueueSize", p.maxQueueSize).
		Msgf("Checking if slot available")

	if int64(p.queue.Len()) >= p.maxQueueSize {
		p.logger.Trace().Str("requestID", req.ID).
			Msg("Slot not available, dropping request")
		return false
	}

	p.logger.Trace().Str("requestID", req.ID).Msg("Slot available, enqueuing")
	heap.Push(p.queue, req)
	return true
}

func (p *queueProcessor) initializeMetrics() error {
	log.Debug().Msgf("Initializing metrics for %s", p.metaData.Name)
	if !p.metaData.IsMetricsEnabled() {
		log.Debug().Msgf("Metrics are disabled for %s", p.metaData.Name)
		return nil
	}

	meter := otel.GetMeter()
	meterObjQueue, err := meter.Int64UpDownCounter(
		requestsInQueueMetric,
		metric.WithDescription("Number of requests in the queue"),
	)
	if err != nil {
		return fmt.Errorf("failed to create requests in queue metric: %w", err)
	}
	meterObjHandled, err := meter.Int64Counter(
		requestsHandledMetric,
		metric.WithDescription("Number of requests handled"),
	)
	if err != nil {
		return fmt.Errorf("failed to create requests handled metric: %w", err)
	}
	p.requestsInQueueMeterObj = meterObjQueue
	p.requestsHandledMeterObj = meterObjHandled
	return nil
}

func (p *queueProcessor) updateMetrics(
	flowName string,
	provider lunar_metrics.APICallMetricsProviderI,
	req *Request,
	enqueued bool,
	ttlExpired bool,
) {
	if !p.metaData.IsMetricsEnabled() {
		return
	}
	attributes := p.labelManager.GetProcessorMetricsAttributes(provider, flowName, p.name)

	var addValue int64
	if enqueued {
		addValue = 1
	} else {
		addValue = -1
	}
	ctx := context.Background()
	attributes = append(attributes, attribute.Key("priority").Int64(req.priority))
	p.requestsInQueueMeterObj.Add(ctx, addValue, metric.WithAttributes(attributes...))

	if !enqueued {
		attributes = append(attributes, attribute.Key("ttl_expired").Bool(ttlExpired))
		p.requestsHandledMeterObj.Add(ctx, 1, metric.WithAttributes(attributes...))
	}
}
