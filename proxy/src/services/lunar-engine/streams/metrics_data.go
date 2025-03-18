package streams

import (
	"lunar/engine/streams/stream"
	streamtypes "lunar/engine/streams/types"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog/log"
)

type processorMetricsData struct {
	avgProcessorExecutionTime     float64
	totalProcessorExecutions      int64
	totalProcessorExecutionTimeNs int64
	mu                            sync.RWMutex
}

type flowMetricsData struct {
	activeFlows                 int64
	flowInvocationsCounter      map[string]int64
	requestsThroughFlowsCounter int64
	avgFlowExecutionTime        float64
	totalFlowExecutions         int64
	totalFlowExecutionTimeNs    int64
	mu                          sync.RWMutex

	procMetricsData *processorMetricsData
}

func newFlowMetricsData() *flowMetricsData {
	return &flowMetricsData{
		flowInvocationsCounter: make(map[string]int64),
		procMetricsData:        &processorMetricsData{},
	}
}

func (f *flowMetricsData) getActiveFlows() int64 {
	return atomic.LoadInt64(&f.activeFlows)
}

func (f *flowMetricsData) getFlowInvocations() map[string]int64 {
	f.mu.RLock()
	defer f.mu.RUnlock()
	flowInvocations := make(map[string]int64)
	for k, v := range f.flowInvocationsCounter {
		flowInvocations[k] = v
	}
	return flowInvocations
}

func (f *flowMetricsData) incrementFlowInvocations(flowName string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.flowInvocationsCounter[flowName] = f.flowInvocationsCounter[flowName] + 1
	log.Trace().
		Int64("flow_invocations", f.flowInvocationsCounter[flowName]).
		Msgf("Incremented %v flow invocations", flowName)
}

func (f *flowMetricsData) getRequestsThroughFlows() int64 {
	return atomic.LoadInt64(&f.requestsThroughFlowsCounter)
}

func (f *flowMetricsData) incrementRequestsThroughFlows() {
	newVal := atomic.AddInt64(&f.requestsThroughFlowsCounter, 1)
	log.Trace().Int64("requests_through_flows", newVal).Msg("Incremented requests through flows")
}

// Measure execution time of a flow
func (f *flowMetricsData) measureFlowExecutionTime(fn func() error) error {
	start := time.Now()
	err := fn()
	if err != nil {
		log.Error().Err(err).Msg("Error in flow execution. Cannot measure execution time")
		return err // return immediately if an error occurs
	}
	duration := time.Since(start)
	log.Trace().Msgf("Flow execution time: %s", duration)

	totalDurationNs := atomic.AddInt64(&f.totalFlowExecutionTimeNs, duration.Nanoseconds())

	totalExecutions := atomic.AddInt64(&f.totalFlowExecutions, 1)
	log.Trace().Msgf("Incremented total flow executions: %d", totalExecutions)

	// Calculate the average time in nanoseconds
	avgExecutionTimeNs := totalDurationNs / totalExecutions
	// Convert the average time to milliseconds
	avgExecutionTimeMs := float64(avgExecutionTimeNs) / 1e6

	log.Trace().Msgf("Calculated average flow execution time: %f ms", avgExecutionTimeMs)

	f.mu.Lock()
	f.avgFlowExecutionTime = avgExecutionTimeMs
	f.mu.Unlock()
	return nil
}

func (f *flowMetricsData) getAvgFlowExecutionTime() float64 {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.avgFlowExecutionTime
}

func (f *flowMetricsData) getAvgProcessorExecutionTime() float64 {
	return f.procMetricsData.getAvgProcessorExecutionTime()
}

func (f *flowMetricsData) setActiveFlows(activeFlows int) {
	atomic.StoreInt64(&f.activeFlows, int64(activeFlows))
}

// Measure execution time of a processor
func (f *processorMetricsData) measureProcExecutionTime(fn stream.ProcessorExecuteFunc) (
	streamtypes.ProcessorIO,
	error,
) {
	start := time.Now()
	res, err := fn()
	if err != nil {
		log.Error().Err(err).Msg("Error in processor execution. Cannot measure execution time")
		return res, err // return immediately if an error occurs
	}
	duration := time.Since(start)
	log.Trace().Msgf("Processor execution time: %s", duration)

	totalExecutions := atomic.AddInt64(&f.totalProcessorExecutions, 1)
	log.Trace().Msgf("Incremented total processor executions: %d", totalExecutions)

	totalDurationNs := atomic.AddInt64(&f.totalProcessorExecutionTimeNs, duration.Nanoseconds())

	// Calculate the average time in nanoseconds
	avgExecutionTimeNs := totalDurationNs / totalExecutions
	// Convert the average time to milliseconds
	avgExecutionTimeMs := float64(avgExecutionTimeNs) / 1e6

	log.Trace().Msgf("Calculated average processor execution time: %f ms", avgExecutionTimeMs)

	f.mu.Lock()
	f.avgProcessorExecutionTime = avgExecutionTimeMs
	f.mu.Unlock()
	return res, nil
}

func (f *processorMetricsData) getAvgProcessorExecutionTime() float64 {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.avgProcessorExecutionTime
}
