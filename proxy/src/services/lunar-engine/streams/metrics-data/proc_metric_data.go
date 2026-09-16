package metricsdata

import (
	"lunar/engine/metrics"
	public_types "lunar/engine/streams/public-types"
	"lunar/engine/streams/stream"
	stream_types "lunar/engine/streams/types"
	"lunar/engine/utils/environment"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog/log"
)

func NewProcessorMetricsData() *ProcessorMetricsData {
	bufferSize := environment.GetLunarMetricsDataChannelBufferSize()

	pmd := &ProcessorMetricsData{
		processorExecutionEvents: make(chan procExecutionEvent, bufferSize),
	}

	// Start the background processing for processor execution events
	go pmd.processExecutionEvents()

	return pmd
}

// Measure execution time of a processor
func (f *ProcessorMetricsData) measureProcExecution(
	flowName string,
	apiStream public_types.APIStreamI,
	fn stream.ProcessorExecuteFunc) (
	stream_types.ProcessorIO,
	error,
) {
	start := time.Now()
	res, err := fn()
	success := true
	if err != nil || res.Failure {
		log.Trace().Err(err).Msgf("Processor execution failed for flow %s", flowName)
		success = false
	}
	duration := time.Since(start)
	log.Trace().Msgf("Processor execution time: %s", duration)
	f.reportExecutionTime(flowName, duration, success, apiStream)

	return res, nil
}

// processExecutionEvents processes the processor execution events in a separate goroutine.
func (f *ProcessorMetricsData) processExecutionEvents() {
	for evt := range f.processorExecutionEvents {
		totalExecutions := atomic.AddInt64(&f.totalProcessorExecutions, 1)
		log.Trace().Msgf("Incremented total processor executions: %d", totalExecutions)

		totalDurationNs := atomic.AddInt64(&f.totalProcessorExecutionTimeNs, evt.Duration.Nanoseconds())

		// Calculate the average time in nanoseconds
		avgExecutionTimeNs := totalDurationNs / totalExecutions
		// Convert the average time to milliseconds
		avgExecutionTimeMs := float64(avgExecutionTimeNs) / 1e6

		log.Trace().Msgf("Calculated average processor execution time: %f ms", avgExecutionTimeMs)

		f.avgProcExecTimeMu.Lock()
		f.avgProcessorExecutionTime = avgExecutionTimeMs
		f.avgProcExecTimeMu.Unlock()
	}
}

// reportExecutionTime queues one flow duration event.
// Non-blocking: if the channel is full, we drop/log rather than block.
func (f *ProcessorMetricsData) reportExecutionTime(
	flowName string,
	duration time.Duration,
	success bool,
	apiStream public_types.APIStreamI,
) {
	evt := procExecutionEvent{
		FlowName: flowName,
		Duration: duration,
		Success:  success,
		StreamID: apiStream.GetID(),
		LabelSet: metrics.NewRequestLabelSet(apiStream),
	}
	select {
	case f.processorExecutionEvents <- evt:
	default:
		log.Debug().Msgf("Processor execution event channel is full, dropping event, flow %s", flowName)
	}
}

// getAvgProcessorExecutionTime returns the average processor execution time.
func (f *ProcessorMetricsData) getAvgProcessorExecutionTime() float64 {
	f.avgProcExecTimeMu.RLock()
	defer f.avgProcExecTimeMu.RUnlock()
	return f.avgProcessorExecutionTime
}
