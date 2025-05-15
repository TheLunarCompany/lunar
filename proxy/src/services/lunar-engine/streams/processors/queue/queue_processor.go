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
	groupByHeader                 = "group_by_header"
	priorityGroupByHeader         = "priority_group_by_header"
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
	defaultIdleTimeForQueue       = 100 * time.Millisecond
)

type queueGroup struct {
	inDrainMode                 bool
	isMetricsEnabled            bool
	name                        string
	processorName               string
	groupName                   string
	quotaID                     string
	queue                       publictypes.SharedQueueI
	resources                   publictypes.ResourceManagementI
	queueTTL                    time.Duration
	maxQueueSize                int64
	maxRedisQueueSize           int64
	priorityGroupByHeader       string
	priorityGroups              map[string]int64
	requestsWatcher             *RequestWatcher
	logger                      zerolog.Logger
	requestsInQueueMeterObj     metric.Int64UpDownCounter
	requestsHandledMeterObj     metric.Int64Counter
	requestsTimeInQueueMeterObj metric.Int64Histogram
	labelManager                *lunar_metrics.LabelManager
}

func newQueueGroup(
	processorName string,
	groupName string,
	quotaID string,
	queueTTL time.Duration,
	maxQueueSize int64,
	maxRedisQueueSize int64,
	priorityGroupByHeader string,
	priorityGroups map[string]int64,
	logger zerolog.Logger,
	sharedMemory publictypes.SharedStateI[string],
	resources publictypes.ResourceManagementI,
	isMetricsEnabled bool,
	requestsInQueueMeterObj metric.Int64UpDownCounter,
	requestsHandledMeterObj metric.Int64Counter,
	requestsTimeInQueueMeterObj metric.Int64Histogram,
	labelManager *lunar_metrics.LabelManager,
) *queueGroup {
	groupKey := fmt.Sprintf("%s-%s", processorName, groupName)
	queueGroup := &queueGroup{
		processorName:               processorName,
		groupName:                   groupName,
		name:                        groupKey,
		quotaID:                     quotaID,
		queueTTL:                    queueTTL,
		queue:                       sharedMemory.NewQueue(groupKey, queueTTL),
		resources:                   resources,
		maxQueueSize:                maxQueueSize,
		maxRedisQueueSize:           maxRedisQueueSize,
		priorityGroupByHeader:       priorityGroupByHeader,
		requestsWatcher:             NewRequestsWatcher(queueTTL, logger),
		priorityGroups:              priorityGroups,
		logger:                      logger.With().Str("group", groupKey).Logger(),
		isMetricsEnabled:            isMetricsEnabled,
		requestsInQueueMeterObj:     requestsInQueueMeterObj,
		requestsHandledMeterObj:     requestsHandledMeterObj,
		requestsTimeInQueueMeterObj: requestsTimeInQueueMeterObj,
		labelManager:                labelManager,
	}

	go queueGroup.process()
	return queueGroup
}

func (pg *queueGroup) tryProcessQueueItems() {
	for pg.queue.Size() > 0 {
		reqID := pg.queue.DequeueIfValueRelevant()
		if reqID == "" {
			pg.logger.Trace().
				Msg("The next request to be processed does not belong to this Gateway instance")
			continue
		}
		req, found := pg.requestsWatcher.GetRequest(reqID)

		if !found || !req.StartProcessing() {
			pg.logger.Trace().Str("requestID", reqID).
				Msg("Request not found in request map, probably already terminated")
			continue
		}

		pg.logger.Trace().Str("requestID", reqID).
			Msgf("Processing request priority: %+v", req.GetPriority())
		if !pg.processQueueItem(req) {
			req.StopProcessing()
			return
		}
		req.SetProcessedSuccess()
	}
}

func (pg *queueGroup) prepareQuotaForNextAttempt(req *Request) error {
	if pg.inDrainMode {
		return nil
	}

	quota, err := pg.resources.GetQuota(pg.quotaID, req.GetAPIStream().GetID())
	if err != nil {
		return err
	}

	return quota.Inc(req.GetAPIStream())
}

// processQueueItem will process the request and return false if the current window is blocked.
func (pg *queueGroup) processQueueItem(request *Request) bool {
	pg.logger.Trace().
		Str("requestID", request.GetID()).
		Msgf("Attempt to process queued request")

	if err := pg.prepareQuotaForNextAttempt(request); err != nil {
		pg.logger.Trace().Err(err).Msgf("Failed to prepare quota for next attempt")
	}

	allowed, err := pg.checkIfAllowed(request)
	if !allowed {
		// Re-enqueue request as it was blocked and we cant continue with this quota ID until it resets
		pg.logger.Trace().
			Err(err).
			Str("requestID", request.GetID()).
			Msgf("Request blocked, re-enqueueing")
		_ = pg.queue.Enqueue(request.GetID(), request.GetPriority())
		return false
	}

	pg.logger.Trace().Msgf("request %s processed in queue", request.GetID())
	return true
}

func (pg *queueGroup) checkIfAllowed(req *Request) (bool, error) {
	if pg.inDrainMode {
		return false, nil
	}

	quota, err := pg.resources.GetQuota(pg.quotaID, req.GetAPIStream().GetID())
	if err != nil {
		return false, err
	}

	allowed, allowedErr := quota.Allowed(req.GetAPIStream())
	if allowedErr != nil {
		return false, err
	}

	if !allowed {
		// If the request is not allowed, we decrement the quota
		// So if the strategy is concurrent, the next request can be processed.
		if err := quota.Dec(req.GetAPIStream()); err != nil {
			pg.logger.Debug().Err(err).Msgf("Failed to decrement quota for request %s", req.GetID())
			pg.logger.Debug().Err(err).Msgf("Failed to decrement quota for request %s", req.GetID())
		}
	}

	return allowed, nil
}

func (pg *queueGroup) getNextProcessTime() time.Duration {
	quota, err := pg.resources.GetQuota(pg.quotaID, "")
	if err != nil {
		pg.logger.Trace().Err(err).Msgf("Failed to get quota with ID %s", pg.quotaID)
		return defaultIdleTimeForQueue
	}
	val := quota.ResetIn()
	return val
}

func (pg *queueGroup) drainQueue() {
	pg.inDrainMode = true
	pg.logger.Debug().Msgf("Draining queue for processor %s", pg.processorName)
	pg.requestsWatcher.StopAll()
}

func (pg *queueGroup) process() {
	ctxManager := context_manager.Get()
	clock := context_manager.Get().GetClock()
	for {
		<-clock.After(pg.getNextProcessTime())
		if ctxManager.GetContext().Err() != nil {
			// If the context is done, we start draining the queue and release requests.
			pg.drainQueue()
			return
		}
		pg.tryProcessQueueItems()
	}
}

func (pg *queueGroup) extractPriority(
	onRequest publictypes.TransactionI,
) float64 {
	if pg.priorityGroupByHeader == "" {
		pg.logger.Trace().Str("requestID", onRequest.GetID()).
			Msg("Priority header not initialized, defaulting to 0")
		return 0
	}
	groupName, found := onRequest.GetHeaders()[pg.priorityGroupByHeader]
	if !found {
		pg.logger.Trace().Str("requestID", onRequest.GetID()).
			Str("priorityGroupByHeader", pg.priorityGroupByHeader).
			Msgf("Priority header not found, defaulting to %d", defaultPriorityWhenGroupFound)
		return defaultPriorityWhenGroupFound
	}
	reqPriority, found := pg.priorityGroups[groupName]
	if !found {
		pg.logger.Trace().Str("requestID", onRequest.GetID()).
			Str("priorityGroupByHeader", pg.priorityGroupByHeader).
			Msgf("Priority not found, defaulting to to %d", defaultPriorityWhenGroupFound)
		return defaultPriorityWhenGroupFound
	}
	pg.logger.Trace().Str("requestID", onRequest.GetID()).
		Str("priorityGroupByHeader", pg.priorityGroupByHeader).
		Msg("Extracting priority")

	return float64(reqPriority)
}

func (pg *queueGroup) enqueueIfSlotAvailable(req *Request) bool {
	pg.logger.Trace().Str("requestID", req.GetID()).
		Int64("QueueCurrentSize", pg.queue.Size()).
		Int64("MaxQueueSize", pg.maxQueueSize).
		Int64("MaxSharedQueueSize", pg.maxRedisQueueSize).
		Msgf("Checking if slot available")

	localSize := pg.requestsWatcher.GetCount()
	if localSize >= pg.maxQueueSize {
		// If the local queue is full, we drop the request
		pg.logger.Debug().Str("requestID", req.GetID()).
			Int64("LocalQueueCurrentSize", localSize).
			Msg("Slot not available, dropping request")
		return false
	}

	currentSize := pg.queue.Size()
	if pg.maxRedisQueueSize > -1 && pg.maxRedisQueueSize <= currentSize {
		// If the shared queue is full, we drop the request and not set to unlimited
		pg.logger.Debug().Str("requestID", req.GetID()).
			Int64("GlobalQueueCurrentSize", currentSize).
			Msg("Slot not available on shared queue, dropping request")
		return false
	}

	pg.requestsWatcher.AddRequest(req)

	pg.logger.Trace().Str("requestID", req.GetID()).Msg("Slot available, enqueuing")
	if err := pg.queue.Enqueue(req.GetID(), req.GetPriority()); err != nil {
		pg.logger.Debug().Err(err).Str("requestID", req.GetID()).
			Msg("Failed to enqueue request")
		return false
	}

	return true
}

func (pg *queueGroup) enqueue(flowName string, apiStream publictypes.APIStreamI) bool {
	priority := pg.extractPriority(apiStream.GetRequest())
	req := NewRequest(
		priority,
		pg.queueTTL,
		apiStream,
	)

	pg.logger.Trace().Str("requestID", req.GetID()).
		Float64("priority", req.GetPriority()).
		Msg("Trying to enqueue")

	if !pg.enqueueIfSlotAvailable(req) {
		pg.logger.Trace().Str("requestID", req.GetID()).
			Msg("Slot not available, dropping request")
		return false
	}

	// This will take care of cleaning up the request from the queue.
	defer func() {
		go pg.removeRequest(req.GetID())
	}()

	pg.logger.Trace().Str("requestID", req.GetID()).
		Msgf("Sending request to be processed in queue")
	// Wait until request is processed or TTL expires
	pg.updateMetrics(flowName, apiStream, req, true, false)

	if req.Wait() {
		pg.logger.Trace().Str("requestID", req.GetID()).
			Msgf("Request processing completed")
		pg.updateHistogramMetric(flowName, apiStream, req, false)
		pg.updateMetrics(flowName, apiStream, req, false, false)
		return true
	}

	pg.logger.Trace().Str("requestID", req.GetID()).
		Msgf("Request processing timed out")
	pg.updateHistogramMetric(flowName, apiStream, req, true)
	pg.updateMetrics(flowName, apiStream, req, false, true)
	return false
}

func (pg *queueGroup) removeRequest(reqID string) {
	pg.requestsWatcher.RemoveFromWatchList(reqID)
	pg.queue.Remove(reqID)
}

func (pg *queueGroup) updateHistogramMetric(
	flowName string,
	provider lunar_metrics.APICallMetricsProviderI,
	req *Request,
	ttlExpired bool,
) {
	if !pg.isMetricsEnabled {
		return
	}
	clock := context_manager.Get().GetClock()
	attributes := pg.labelManager.GetProcessorMetricsAttributes(provider, flowName, pg.processorName)
	ctx := context.Background()
	attributes = append(attributes, attribute.Key("priority").Float64(req.GetPriority()))
	attributes = append(attributes, attribute.Key("ttl_expired").Bool(ttlExpired))
	attributes = append(attributes, attribute.Key("group").String(pg.groupName))
	pg.requestsTimeInQueueMeterObj.Record(
		ctx,
		int64(clock.Now().Sub(req.GetTimestamp()).Milliseconds()),
		metric.WithAttributes(attributes...),
	)
}

func (pg *queueGroup) updateMetrics(
	flowName string,
	provider lunar_metrics.APICallMetricsProviderI,
	req *Request,
	enqueued bool,
	ttlExpired bool,
) {
	if !pg.isMetricsEnabled {
		return
	}
	attributes := pg.labelManager.GetProcessorMetricsAttributes(provider, flowName, pg.processorName)

	var addValue int64
	if enqueued {
		addValue = 1
	} else {
		addValue = -1
	}
	ctx := context.Background()
	attributes = append(attributes, attribute.Key("priority").Float64(req.GetPriority()))
	attributes = append(attributes, attribute.Key("group").String(pg.groupName))
	pg.requestsInQueueMeterObj.Add(ctx, addValue, metric.WithAttributes(attributes...))

	if !enqueued {
		attributes = append(attributes, attribute.Key("ttl_expired").Bool(ttlExpired))
		pg.requestsHandledMeterObj.Add(ctx, 1, metric.WithAttributes(attributes...))
	}
}

type queueProcessor struct {
	mutex                       sync.Mutex
	quotaID                     string
	name                        string
	queueTTL                    time.Duration
	maxQueueSize                int64
	maxRedisQueueSize           int64
	priorityGroupByHeader       string
	groupByHeader               string
	priorityGroups              map[string]int64
	queues                      map[string]*queueGroup
	clock                       clock.Clock
	logger                      zerolog.Logger
	requestsInQueueMeterObj     metric.Int64UpDownCounter
	requestsHandledMeterObj     metric.Int64Counter
	requestsTimeInQueueMeterObj metric.Int64Histogram
	labelManager                *lunar_metrics.LabelManager
	metaData                    *streamtypes.ProcessorMetaData
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	proc := &queueProcessor{
		name:           metaData.Name,
		metaData:       metaData,
		priorityGroups: make(map[string]int64),
		queues:         make(map[string]*queueGroup),
		clock:          metaData.GetClock(),
		labelManager:   lunar_metrics.NewLabelManager(metaData.GetMetricLabels()),
	}

	if err := proc.init(); err != nil {
		return nil, err
	}

	// TODO: We use the queueTTL as the item TTL for the queue.
	// As this duration can be long, we should consider using a different value for the item TTL.
	// This will be addressed in a future PR.

	err := proc.initializeMetrics()
	if err != nil {
		proc.logger.Error().Err(err).Msgf("failed to initialize metrics for %s", metaData.Name)
		proc.metaData.Metrics.Enabled = false
	}

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

	queue := p.getQueue(apiStream.GetRequest())
	if queue == nil {
		p.logger.Trace().Str("requestID", apiStream.GetRequest().GetID()).
			Msg("Queue not found, returning early response")
		return streamtypes.ProcessorIO{
			Type: publictypes.StreamTypeAny,
			Name: "blocked",
		}, nil
	}

	canProcess := queue.enqueue(flowName, apiStream)
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

// If priority is not defined/find, it will default to 0,
// which is the highest priority.
func (p *queueProcessor) getQueue(
	onRequest publictypes.TransactionI,
) *queueGroup {
	group := "lunar_default"
	if p.groupByHeader != "" && p.groupByHeader != "lunar_default" {
		var found bool
		group, found = onRequest.GetHeaders()[p.groupByHeader]
		if !found {
			p.logger.Trace().Str("requestID", onRequest.GetID()).
				Str("groupByHeader", p.groupByHeader).
				Msgf("Group not found, defaulting to %s", group)
		}
	}

	p.mutex.Lock()
	defer p.mutex.Unlock()
	queue, found := p.queues[group]
	if !found {
		p.queues[group] = newQueueGroup(
			p.name,
			group,
			p.quotaID,
			p.queueTTL,
			p.maxQueueSize,
			p.maxRedisQueueSize,
			p.priorityGroupByHeader,
			p.priorityGroups,
			p.logger,
			p.metaData.SharedMemory,
			p.metaData.Resources,
			p.metaData.IsMetricsEnabled(),
			p.requestsInQueueMeterObj,
			p.requestsHandledMeterObj,
			p.requestsTimeInQueueMeterObj,
			p.labelManager,
		)
		queue = p.queues[group]
	}

	p.logger.Trace().Str("requestID", onRequest.GetID()).
		Str("groupByHeader", p.groupByHeader).
		Msg("Extracting priority")

	return queue
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
		p.logger.Debug().Err(err).Msgf("Failed to set quota %s as handled", p.quotaID)
	}

	if err := utils.ExtractStrParam(p.metaData.Parameters,
		priorityGroupByHeader, &p.priorityGroupByHeader); err != nil {
		return err
	}

	if err := utils.ExtractStrParam(p.metaData.Parameters,
		groupByHeader, &p.groupByHeader); err != nil {
		return err
	}

	if err := utils.ExtractMapOfInt64Param(p.metaData.Parameters,
		groupsParam, p.priorityGroups); err != nil {
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
		Str("processor", p.name).
		Str("quotaID", p.quotaID).Logger()
	return nil
}

func (p *queueProcessor) initializeMetrics() error {
	p.logger.Debug().Msgf("Initializing metrics for %s", p.metaData.Name)
	if !p.metaData.IsMetricsEnabled() {
		p.logger.Debug().Msgf("Metrics are disabled for %s", p.metaData.Name)
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

func (p *queueProcessor) validateProcessingTimeoutIsGreaterTheTTL() error {
	ProcessingTimeout, err := environment.GetSpoeProcessingTimeout()
	if err != nil {
		p.logger.Warn().Err(err).
			Msgf("Could not get SPOE processing timeout, using default of %v seconds",
				defaultProcessingTimeout)
		ProcessingTimeout = defaultProcessingTimeout
	}

	if ProcessingTimeout <= p.queueTTL {
		return fmt.Errorf("processing timeout (%v) is less than queue TTL (%v). please set 'LUNAR_SPOE_PROCESSING_TIMEOUT_SEC' to a value greater than %v", ProcessingTimeout, p.queueTTL, p.queueTTL) //nolint:lll
	}

	return nil
}
