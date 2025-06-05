package streams

import (
	"lunar/engine/metrics"
	public_types "lunar/engine/streams/public-types"
	"lunar/engine/streams/stream"
	stream_types "lunar/engine/streams/types"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog/log"
)

type processorExecuteData struct {
	flowName        string
	requestLabelSet *metrics.LabelSet
	success         bool
}

type processorMetricsData struct {
	avgProcessorExecutionTime     float64
	totalProcessorExecutions      int64
	totalProcessorExecutionTimeNs int64
	execution                     map[string]*processorExecuteData // key - stream ID
	mu                            sync.RWMutex
}

func newProcessorMetricsData() *processorMetricsData {
	return &processorMetricsData{
		execution: make(map[string]*processorExecuteData),
	}
}

type flowMetricsData struct {
	activeFlows                     []string
	flowInvocationsData             map[string]*metrics.LabelsExecutionData
	requestsThroughFlowsData        *metrics.LabelsExecutionData
	avgFlowExecutionTimePerFlow     map[string]float64               // key - flow ID
	totalFlowExecutionsPerFlow      map[string]int64                 // key - flow ID
	totalFlowExecutionTimeNsPerFlow map[string]int64                 // key - flow ID
	procMetricsData                 map[string]*processorMetricsData // key - processor key
	mu                              sync.RWMutex
}

func newFlowMetricsData() *flowMetricsData {
	return &flowMetricsData{
		activeFlows:                     make([]string, 0),
		flowInvocationsData:             make(map[string]*metrics.LabelsExecutionData),
		avgFlowExecutionTimePerFlow:     make(map[string]float64),
		totalFlowExecutionsPerFlow:      make(map[string]int64),
		totalFlowExecutionTimeNsPerFlow: make(map[string]int64),
		procMetricsData:                 make(map[string]*processorMetricsData),
		requestsThroughFlowsData:        metrics.NewFlowsLabelsData(),
	}
}

func (f *flowMetricsData) getActiveFlows() *metrics.MetricData {
	f.mu.RLock()
	defer f.mu.RUnlock()

	return &metrics.MetricData{
		ActiveFlows: f.activeFlows,
	}
}

func (f *flowMetricsData) getFlowInvocations() *metrics.MetricData {
	f.mu.RLock()
	defer f.mu.RUnlock()

	return &metrics.MetricData{
		FlowInvocations: f.flowInvocationsData,
	}
}

func (f *flowMetricsData) incrementFlowInvocations(
	flowName string,
	apiStream public_types.APIStreamI,
) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if _, exists := f.flowInvocationsData[flowName]; !exists {
		f.flowInvocationsData[flowName] = metrics.NewFlowsLabelsData()
	}

	labelSet := metrics.NewRequestLabelSet(apiStream)
	f.flowInvocationsData[flowName].AddRequestLabelSet(apiStream.GetID(), labelSet)

	log.Trace().
		Int64("flow_invocations", f.flowInvocationsData[flowName].GetNumberOfCalls()).
		Msgf("Incremented %v flow invocations", flowName)
}

func (f *flowMetricsData) getRequestsThroughFlows() *metrics.MetricData {
	f.mu.RLock()
	defer f.mu.RUnlock()

	return &metrics.MetricData{
		RequestsThroughFlows: f.requestsThroughFlowsData,
	}
}

func (f *flowMetricsData) incrementRequestsThroughFlows(apiStream public_types.APIStreamI) {
	labelSet := metrics.NewRequestLabelSet(apiStream)

	f.mu.Lock()
	f.requestsThroughFlowsData.AddRequestLabelSet(apiStream.GetID(), labelSet)
	newCounter := f.requestsThroughFlowsData.GetNumberOfCalls()
	f.mu.Unlock()

	log.Trace().Int64("requests_through_flows", newCounter).Msg("Incremented requests through flows")
}

// Measure execution time of a flow
func (f *flowMetricsData) measureFlowExecutionTime(flowName string, fn func() error) error {
	start := time.Now()
	err := fn()
	if err != nil {
		log.Error().Err(err).Msg("Error in flow execution. Cannot measure execution time")
		return err // return immediately if an error occurs
	}
	duration := time.Since(start)
	log.Trace().Msgf("Flow %s, execution time: %s", flowName, duration)

	f.mu.Lock()
	defer f.mu.Unlock()

	f.totalFlowExecutionTimeNsPerFlow[flowName] += duration.Nanoseconds()
	totalDurationNs := f.totalFlowExecutionTimeNsPerFlow[flowName]

	f.totalFlowExecutionsPerFlow[flowName]++

	totalExecutions := f.totalFlowExecutionsPerFlow[flowName]
	log.Trace().Msgf("Incremented total flow executions: %d for flow %s", totalExecutions, flowName)

	// Calculate the average time in nanoseconds
	avgExecutionTimeNs := totalDurationNs / totalExecutions
	// Convert the average time to milliseconds
	avgExecutionTimeMs := float64(avgExecutionTimeNs) / 1e6

	log.Trace().Msgf("Calculated average flow %s execution time: %f ms", flowName, avgExecutionTimeMs)
	f.avgFlowExecutionTimePerFlow[flowName] = avgExecutionTimeMs

	return nil
}

func (f *flowMetricsData) getAvgFlowExecutionTime() *metrics.MetricData {
	f.mu.RLock()
	defer f.mu.RUnlock()

	return &metrics.MetricData{
		AvgFlowExecutionTime: f.avgFlowExecutionTimePerFlow,
		FlowInvocations:      f.flowInvocationsData,
	}
}

func (f *flowMetricsData) getProcessorExecutionData() *metrics.MetricData {
	f.mu.RLock()
	defer f.mu.RUnlock()

	procExecData := make(map[string]*metrics.ProcData)
	for key, procData := range f.procMetricsData {
		if len(procData.execution) == 0 {
			log.Trace().Msgf("No execution data for processor %s", key)
			continue
		}
		var executions []*metrics.ProcExecution
		for _, execData := range procData.execution {
			exec := &metrics.ProcExecution{
				FlowName:    execData.flowName,
				ReqLabelSet: execData.requestLabelSet,
				Success:     execData.success,
			}
			executions = append(executions, exec)
		}

		procExecData[key] = &metrics.ProcData{
			AvgExecutionTime: procData.getAvgProcessorExecutionTime(),
			Executions:       executions,
		}
		execTime := procExecData[key].AvgExecutionTime
		log.Trace().Msgf("Processor %s, avg exe time: %f ms", key, execTime)
	}

	return &metrics.MetricData{
		ProcExecutionData: procExecData,
		FlowInvocations:   f.flowInvocationsData,
	}
}

func (f *flowMetricsData) setActiveFlows(activeFlows []string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.activeFlows = activeFlows
}

func (f *flowMetricsData) getProcMeasureExecFunc(
	procKey string,
) func(string, public_types.APIStreamI, stream.ProcessorExecuteFunc) (stream_types.ProcessorIO,
	error) {
	f.mu.Lock()
	defer f.mu.Unlock()

	if _, exists := f.procMetricsData[procKey]; !exists {
		f.procMetricsData[procKey] = newProcessorMetricsData()
	}

	return f.procMetricsData[procKey].measureProcExecution
}

// Measure execution time of a processor
func (f *processorMetricsData) measureProcExecution(
	flowName string,
	apiStream public_types.APIStreamI, // reserved for future use
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
	f.execution[apiStream.GetID()] = &processorExecuteData{
		flowName:        flowName,
		requestLabelSet: metrics.NewRequestLabelSet(apiStream),
		success:         success,
	}
	f.mu.Unlock()
	return res, nil
}

func (f *processorMetricsData) getAvgProcessorExecutionTime() float64 {
	f.mu.RLock()
	defer f.mu.RUnlock()
	return f.avgProcessorExecutionTime
}
