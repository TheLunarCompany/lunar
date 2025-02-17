package processorqueue

import (
	"context"
	"fmt"
	"lunar/engine/streams/processors/utils"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
	"lunar/engine/utils/environment"
	clock "lunar/toolkit-core/clock"
	context_manager "lunar/toolkit-core/context-manager"
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
	groupByHeader                 = "priority_group_by_header"
	quotaParam                    = "quota_id"
	queueSize                     = "queue_size"
	queueTTL                      = "ttl_seconds"
	groupsParam                   = "priority_groups"
	redisQueueSize                = "redis_queue_size"
	requestsInQueueMetric         = "lunar_processor_queue_requests_in_queue"
	requestsHandledMetric         = "lunar_processor_queue_requests_handled"
	requestsTimeInQueueMetric     = "lunar_processor_queue_requests_time_in_queue"
	defaultProcessingTimeout      = time.Second * time.Duration(30)
	defaultPriorityWhenGroupFound = 999
)

type queueProcessor struct {
	mutex                       sync.Mutex
	quotaID                     string
	name                        string
	queue                       publictypes.SharedQueueI
	queueTTL                    time.Duration
	maxQueueSize                int64
	maxRedisQueueSize           int64
	groupByHeader               string
	groups                      map[string]int64
	clock                       clock.Clock
	logger                      zerolog.Logger
	reqIDtoReq                  map[string]*Request
	requestsInQueueMeterObj     metric.Int64UpDownCounter
	requestsHandledMeterObj     metric.Int64Counter
	requestsTimeInQueueMeterObj metric.Int64Histogram
	labelManager                *lunar_metrics.LabelManager
	metaData                    *streamtypes.ProcessorMetaData
	inDrainMode                 bool
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	proc := &queueProcessor{
		name:         metaData.Name,
		metaData:     metaData,
		groups:       make(map[string]int64),
		clock:        metaData.GetClock(),
		reqIDtoReq:   make(map[string]*Request),
		labelManager: lunar_metrics.NewLabelManager(metaData.GetMetricLabels()),
	}

	if err := proc.init(); err != nil {
		return nil, err
	}

	for key, value := range proc.groups {
		log.Trace().Msgf("Group %s has priority %d", key, value)
	}

	// TODO: We use the queueTTL as the item TTL for the queue.
	// As this duration can be long, we should consider using a different value for the item TTL.
	// This will be addressed in a future PR.
	proc.queue = metaData.SharedMemory.NewQueue(proc.quotaID, proc.queueTTL)

	err := proc.initializeMetrics()
	if err != nil {
		log.Error().Err(err).Msgf("failed to initialize metrics for %s", metaData.Name)
		proc.metaData.Metrics.Enabled = false
	}

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
	p.removeRequest(apiStream.GetID())

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

func (p *queueProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{}
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
		Float64("priority", req.priority).
		Msg("Trying to enqueue")

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
			p.updateHistogramMetric(flowName, apiStream, req, false)
			p.updateMetrics(flowName, apiStream, req, false, false)
			return true, nil

		case <-p.clock.After(p.queueTTL):
			p.logger.Trace().Str("requestID", req.ID).
				Msgf("Request TTLed (now: %+v, ttl: %+v)", p.clock.Now(), p.queueTTL)
			p.updateHistogramMetric(flowName, apiStream, req, true)
			p.updateMetrics(flowName, apiStream, req, false, true)
			return false, nil
		}
	}
}

func (p *queueProcessor) getNextProcessTime() time.Duration {
	// TODO: Fix the ResetIn calculation.
	// This is a temporary fix to avoid the processor from consuming too much CPU.
	return 100 * time.Millisecond
}

func (p *queueProcessor) process() {
	ctxManager := context_manager.Get()
	for {
		<-p.clock.After(p.getNextProcessTime())

		if ctxManager.GetContext().Err() != nil {
			// If the context is done, we start draining the queue and release requests.
			p.drainQueue()
			return
		}

		p.tryProcessQueueItems()
	}
}

func (p *queueProcessor) drainQueue() {
	p.inDrainMode = true
	for key, request := range p.reqIDtoReq {
		p.logger.Trace().Str("requestID", key).Msg("Draining request")
		request.CloseChan()
		p.queue.Remove(key)
	}
}

func (p *queueProcessor) tryProcessQueueItems() {
	for p.queue.Size() > 0 {
		reqID := p.queue.DequeueIfValueMatch(p.isRequestInInstance)
		if reqID == "" {
			log.Trace().Msg("The next request to be processed does not belong to this Gateway instance")
			continue
		}

		p.mutex.Lock()
		req, found := p.reqIDtoReq[reqID]
		p.mutex.Unlock()

		if !found {
			log.Trace().Str("requestID", reqID).
				Msg("Request not found in request map, probably already terminated")
			continue
		}
		log.Trace().Str("requestID", reqID).Msgf("Processing request priority: %+v", req.priority)
		if !p.processQueueItem(req) {
			return
		}
	}
}

// processQueueItem will process the request and return false if the current window is blocked.
func (p *queueProcessor) processQueueItem(request *Request) bool {
	p.logger.Trace().
		Str("requestID", request.ID).
		Msgf("Attempt to process queued request")

	if err := p.prepareQuotaForNextAttempt(request); err != nil {
		log.Trace().Err(err).Msgf("Failed to prepare quota for next attempt")
	}

	allowed, err := p.checkIfAllowed(request)
	if !allowed {
		// Re-enqueue request as it was blocked and we cant continue with this quota ID until it resets
		p.logger.Trace().
			Err(err).
			Str("requestID", request.ID).
			Msgf("Request blocked, re-enqueueing")
		_ = p.queue.Enqueue(request.ID, request.priority)
		return false
	}

	select {
	case request.doneCh <- struct{}{}:
		// We close the request channel to avoid memory leaks, as the request has been processed
		request.CloseChan()
		p.logger.Trace().Str("requestID", request.ID).
			Msgf("notified successful request processing to req.doneCh")
	default:
		p.logger.Trace().Str("requestID", request.ID).
			Msgf("req.doneCh already closed")
	}
	p.logger.Trace().Msgf("request %s processed in queue", request.ID)

	return true
}

// If priority is not defined/find, it will default to 0,
// which is the highest priority.
func (p *queueProcessor) extractPriority(
	onRequest publictypes.TransactionI,
) float64 {
	if p.groupByHeader == "" {
		p.logger.Trace().Str("requestID", onRequest.GetID()).
			Msg("Priority header not initialized, defaulting to 0")
		return 0
	}
	groupName, found := onRequest.GetHeaders()[p.groupByHeader]
	if !found {
		p.logger.Trace().Str("requestID", onRequest.GetID()).
			Str("groupByHeader", p.groupByHeader).
			Msgf("Priority header not found, defaulting to %d", defaultPriorityWhenGroupFound)
		return defaultPriorityWhenGroupFound
	}
	reqPriority, found := p.groups[groupName]
	if !found {
		p.logger.Trace().Str("requestID", onRequest.GetID()).
			Str("groupByHeader", p.groupByHeader).
			Msgf("Priority not found, defaulting to to %d", defaultPriorityWhenGroupFound)
		return defaultPriorityWhenGroupFound
	}
	p.logger.Trace().Str("requestID", onRequest.GetID()).
		Str("groupByHeader", p.groupByHeader).
		Msg("Extracting priority")

	return float64(reqPriority)
}

func (p *queueProcessor) checkIfAllowed(req *Request) (bool, error) {
	if p.inDrainMode {
		return false, nil
	}

	quota, err := p.metaData.Resources.GetQuota(p.quotaID, req.APIStream.GetID())
	if err != nil {
		return false, err
	}

	return quota.Allowed(req.APIStream)
}

func (p *queueProcessor) prepareQuotaForNextAttempt(req *Request) error {
	if p.inDrainMode {
		return nil
	}

	quota, err := p.metaData.Resources.GetQuota(p.quotaID, req.APIStream.GetID())
	if err != nil {
		return err
	}

	return quota.Inc(req.APIStream)
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

	if err := p.metaData.SharedMemory.Set(p.quotaID, "true"); err != nil {
		log.Debug().Err(err).Msgf("Failed to set quota %s as handled", p.quotaID)
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

	if err := utils.ExtractInt64Param(p.metaData.Parameters,
		redisQueueSize, &p.maxRedisQueueSize); err != nil {
		return err
	}

	if err := utils.ExtractDurationInSecParam(
		p.metaData.Parameters, queueTTL, &p.queueTTL); err != nil {
		return err
	}

	// Validate that processing timeout is greater than queue TTL
	if err := p.validateProcessingTimeoutIsGreaterTheTTL(); err != nil {
		return err
	}

	p.logger = log.Logger.With().
		Str("processor", "queueProcessor").
		Str("quotaID", p.quotaID).Logger()
	return nil
}

func (p *queueProcessor) enqueueIfSlotAvailable(req *Request) bool {
	p.logger.Trace().Str("requestID", req.ID).
		Int64("QueueCurrentSize", p.queue.Size()).
		Int64("MaxQueueSize", p.maxQueueSize).
		Int64("MaxSharedQueueSize", p.maxRedisQueueSize).
		Msgf("Checking if slot available")

	p.mutex.Lock()
	localSize := int64(len(p.reqIDtoReq))
	p.mutex.Unlock()

	if localSize >= p.maxQueueSize {
		// If the local queue is full, we drop the request
		p.logger.Debug().Str("requestID", req.ID).
			Int64("LocalQueueCurrentSize", localSize).
			Msg("Slot not available, dropping request")
		return false
	}

	currentSize := p.queue.Size()
	if p.maxRedisQueueSize > -1 && p.maxRedisQueueSize <= currentSize {
		// If the shared queue is full, we drop the request and not set to unlimited
		p.logger.Debug().Str("requestID", req.ID).
			Int64("GlobalQueueCurrentSize", currentSize).
			Msg("Slot not available on shared queue, dropping request")
		return false
	}

	p.logger.Trace().Str("requestID", req.ID).Msg("Slot available, enqueuing")
	p.addValueToRequestMap(req)
	if err := p.queue.Enqueue(req.ID, req.priority); err != nil {
		p.logger.Debug().Err(err).Str("requestID", req.ID).
			Msg("Failed to enqueue request")
		return false
	}

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

	buckets := []float64{
		10,
		float64(p.queueTTL.Milliseconds()) * 0.25,
		float64(p.queueTTL.Milliseconds()) * 0.50,
		float64(p.queueTTL.Milliseconds()) * 0.75,
		float64(p.queueTTL.Milliseconds()),
	}

	meterObjTimeInQueue, err := meter.Int64Histogram(
		requestsTimeInQueueMetric,
		metric.WithDescription("The time a request spent in the queue"),
		metric.WithUnit("ms"),
		metric.WithExplicitBucketBoundaries(buckets...),
	)
	if err != nil {
		return fmt.Errorf("failed to create requests time in queue metric: %w", err)
	}

	p.requestsInQueueMeterObj = meterObjQueue
	p.requestsHandledMeterObj = meterObjHandled
	p.requestsTimeInQueueMeterObj = meterObjTimeInQueue
	return nil
}

func (p *queueProcessor) updateHistogramMetric(
	flowName string,
	provider lunar_metrics.APICallMetricsProviderI,
	req *Request,
	ttlExpired bool,
) {
	if !p.metaData.IsMetricsEnabled() {
		return
	}
	attributes := p.labelManager.GetProcessorMetricsAttributes(provider, flowName, p.name)
	ctx := context.Background()
	attributes = append(attributes, attribute.Key("priority").Float64(req.priority))
	attributes = append(attributes, attribute.Key("ttl_expired").Bool(ttlExpired))
	p.requestsTimeInQueueMeterObj.Record(
		ctx,
		int64(p.clock.Now().Sub(req.GetTimestamp()).Milliseconds()),
		metric.WithAttributes(attributes...),
	)
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
	attributes = append(attributes, attribute.Key("priority").Float64(req.priority))
	p.requestsInQueueMeterObj.Add(ctx, addValue, metric.WithAttributes(attributes...))

	if !enqueued {
		attributes = append(attributes, attribute.Key("ttl_expired").Bool(ttlExpired))
		p.requestsHandledMeterObj.Add(ctx, 1, metric.WithAttributes(attributes...))
	}
}

func (p *queueProcessor) validateProcessingTimeoutIsGreaterTheTTL() error {
	ProcessingTimeout, err := environment.GetSpoeProcessingTimeout()
	if err != nil {
		log.Warn().Err(err).Msgf("Could not get SPOE processing timeout, using default of %v seconds",
			defaultProcessingTimeout)
		ProcessingTimeout = defaultProcessingTimeout
	}

	if ProcessingTimeout <= p.queueTTL {
		return fmt.Errorf("processing timeout (%v) is less than queue TTL (%v). please set 'LUNAR_SPOE_PROCESSING_TIMEOUT_SEC' to a value greater than %v", ProcessingTimeout, p.queueTTL, p.queueTTL) //nolint:lll
	}

	return nil
}

func (p *queueProcessor) isRequestInInstance(requestID string) bool {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	_, found := p.reqIDtoReq[requestID]
	return found
}

func (p *queueProcessor) removeRequest(value string) {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	delete(p.reqIDtoReq, value)
	p.queue.Remove(value)
}

func (p *queueProcessor) addValueToRequestMap(req *Request) {
	p.mutex.Lock()
	defer p.mutex.Unlock()
	p.reqIDtoReq[req.ID] = req
}
