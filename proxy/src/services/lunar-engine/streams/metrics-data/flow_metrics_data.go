package metricsdata

import (
	"lunar/engine/metrics"
	public_types "lunar/engine/streams/public-types"
	"lunar/engine/streams/stream"
	"lunar/engine/utils/environment"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
)

func NewFlowMetricsData() *FlowMetricsData {
	bufferSize := environment.GetLunarMetricsDataChannelBufferSize()
	fmd := &FlowMetricsData{
		avgFlowExecutionTimePerFlow:     sync.Map{},
		totalFlowExecutionsPerFlow:      make(map[string]int64),
		totalFlowExecutionTimeNsPerFlow: make(map[string]int64),
		procMetricsData:                 sync.Map{},

		flowInvocationEvents: make(chan flowInvocationEvent, bufferSize),
		requestsThroughFlows: make(chan flowInvocationEvent, bufferSize),
		flowDurationEvents:   make(chan flowDurationEvent, bufferSize),
	}

	// Start the background processing
	go fmd.processFlowInvocations()
	go fmd.processRequestsThroughFlows()
	go fmd.processFlowDurationEvents()

	return fmd
}

func (f *FlowMetricsData) RegisterFlowInvocationsObserver(obs func(*metrics.MetricData)) {
	f.flowInvocationsObserver = obs
}

func (f *FlowMetricsData) RegisterRequestsThroughFlowsObserver(obs func(*metrics.MetricData)) {
	f.requestsThroughFlowsObserver = obs
}

func (f *FlowMetricsData) RegisterProcessorExecutionObserver(obs func(*metrics.MetricData)) {
	f.processorExecutionObserver = obs
}

// MeasureFlowExecutionTime measures the execution time of a flow and reports it.
func (f *FlowMetricsData) MeasureFlowExecutionTime(flowName string, fn func() error) error {
	start := time.Now()
	err := fn()
	if err != nil {
		return err
	}
	duration := time.Since(start)
	log.Trace().Msgf("Flow %s, execution time: %s", flowName, duration)

	f.reportExecutionTime(flowName, duration)

	return nil
}

// IncrementFlowInvocations queues one invocation event.
// Non-blocking: if the channel is full, we drop/log rather than block.
func (f *FlowMetricsData) IncrementFlowInvocations(
	flowName string,
	apiStream public_types.APIStreamI,
) {
	evt := flowInvocationEvent{
		FlowName: flowName,
		StreamID: apiStream.GetID(),
		LabelSet: metrics.NewRequestLabelSet(apiStream),
	}
	select {
	case f.flowInvocationEvents <- evt:
	default:
		log.Debug().Msgf("Flow invocation event chan is full, dropping event, flow %s", flowName)
	}
}

// IncrementRequestsThroughFlows queues one invocation event.
// Non-blocking: if the channel is full, we drop/log rather than block.
func (f *FlowMetricsData) IncrementRequestsThroughFlows(apiStream public_types.APIStreamI) {
	evt := flowInvocationEvent{
		StreamID: apiStream.GetID(),
		LabelSet: metrics.NewRequestLabelSet(apiStream),
	}
	select {
	case f.requestsThroughFlows <- evt:
	default:
		log.Debug().Msgf("Requests through flows chan is full, dropping event, stream %s", evt.StreamID)
	}
}

// SetActiveFlows sets the currently active flows.
func (f *FlowMetricsData) SetActiveFlows(activeFlows []string) {
	f.activeFlowsMu.Lock()
	defer f.activeFlowsMu.Unlock()
	f.activeFlows = activeFlows

	log.Trace().Msgf("Active flows updated: %v", f.activeFlows)
}

func (f *FlowMetricsData) GetActiveFlows() *metrics.MetricData {
	f.activeFlowsMu.RLock()
	defer f.activeFlowsMu.RUnlock()
	return &metrics.MetricData{
		ActiveFlows: append([]string{}, f.activeFlows...), // Return a copy
	}
}

// GetAvgFlowExecutionTime returns the average flow execution time.
func (f *FlowMetricsData) GetAvgFlowExecutionTime() *metrics.MetricData {
	avgFlowExecutionTime := make(map[string]float64)
	f.avgFlowExecutionTimePerFlow.Range(func(key, value any) bool {
		flowID := key.(string)
		avgTime := value.(float64)
		avgFlowExecutionTime[flowID] = avgTime
		return true
	})
	return &metrics.MetricData{
		AvgFlowExecutionTime: avgFlowExecutionTime,
	}
}

func (f *FlowMetricsData) GetProcMeasureExecFunc(procKey string) stream.MeasureExecutorFunc {
	raw, loaded := f.procMetricsData.Load(procKey)
	if !loaded {
		raw = NewProcessorMetricsData()
		f.procMetricsData.Store(procKey, raw)
	}
	return raw.(*ProcessorMetricsData).measureProcExecution
}

func (f *FlowMetricsData) GetProcessorExecutionData() *metrics.MetricData {
	procExecData := make(map[string]*metrics.ProcData)

	f.procMetricsData.Range(func(key, value any) bool {
		procData := value.(*ProcessorMetricsData)

		procExecData[key.(string)] = &metrics.ProcData{
			AvgExecutionTime: procData.getAvgProcessorExecutionTime(),
		}

		execTime := procExecData[key.(string)].AvgExecutionTime
		log.Trace().Msgf("Processor %s, avg exe time: %f ms", key, execTime)
		return true
	})

	return &metrics.MetricData{
		ProcExecutionData: procExecData,
	}
}

// processFlowInvocations runs in a goroutine and handles incoming events.
func (f *FlowMetricsData) processFlowInvocations() {
	for evt := range f.flowInvocationEvents {
		if f.flowInvocationsObserver == nil {
			log.Debug().Msg("Flow invocations observer is not set, skipping flow invocation update")
			continue
		}

		f.flowInvocationsObserver(&metrics.MetricData{
			FlowInvocations: &metrics.FlowInvocationsData{
				FlowID: evt.FlowName,
				Labels: evt.LabelSet,
			},
		})

		log.Trace().Msgf("Incremented %v flow invocations", evt.FlowName)
	}
}

// processRequestsThroughFlows runs in a goroutine and handles incoming events.
func (f *FlowMetricsData) processRequestsThroughFlows() {
	for evt := range f.requestsThroughFlows {
		if f.requestsThroughFlowsObserver == nil {
			log.Debug().Msg("Requests through flows observer is not set")
			continue
		}
		f.requestsThroughFlowsObserver(&metrics.MetricData{
			RequestsThroughFlows: &metrics.RequestsThroughFlowData{
				StreamID: evt.StreamID,
				Labels:   evt.LabelSet,
			},
		})

		log.Trace().Msgf("Incremented requests through flows for %s", evt.FlowName)
	}
}

// reportExecutionTime queues one flow duration event.
// Non-blocking: if the channel is full, we drop/log rather than block.
func (f *FlowMetricsData) reportExecutionTime(flowName string, duration time.Duration) {
	evt := flowDurationEvent{
		FlowName: flowName,
		Duration: duration,
	}
	select {
	case f.flowDurationEvents <- evt:
	default:
		log.Debug().Msgf("Flow duration events chan is full, dropping event, flow %s", flowName)
	}
}

// processFlowDurationEvents runs in a goroutine and handles incoming flow duration events.
func (f *FlowMetricsData) processFlowDurationEvents() {
	for evt := range f.flowDurationEvents {
		if _, ok := f.totalFlowExecutionTimeNsPerFlow[evt.FlowName]; !ok {
			f.totalFlowExecutionTimeNsPerFlow[evt.FlowName] = 0
		}

		f.totalFlowExecutionTimeNsPerFlow[evt.FlowName] += evt.Duration.Nanoseconds()
		totalDurationNs := f.totalFlowExecutionTimeNsPerFlow[evt.FlowName]

		if _, ok := f.totalFlowExecutionsPerFlow[evt.FlowName]; !ok {
			f.totalFlowExecutionsPerFlow[evt.FlowName] = 0
		}

		f.totalFlowExecutionsPerFlow[evt.FlowName]++
		totalExecutions := f.totalFlowExecutionsPerFlow[evt.FlowName]

		log.Trace().Msgf("Incremented total flow executions: %d, flow %s", totalExecutions, evt.FlowName)

		// Calculate the average time in nanoseconds
		avgExecutionTimeNs := totalDurationNs / totalExecutions
		// Convert the average time to milliseconds
		avgExecutionTimeMs := float64(avgExecutionTimeNs) / 1e6

		log.Trace().Msgf("Average flow %s execution time: %f ms", evt.FlowName, avgExecutionTimeMs)
		f.avgFlowExecutionTimePerFlow.Store(evt.FlowName, avgExecutionTimeMs)
	}
}
