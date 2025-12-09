package metricsdata

import (
	"lunar/engine/metrics"
	"sync"
	"time"
)

type FlowMetricsData struct {
	activeFlowsMu                sync.RWMutex
	activeFlows                  []string
	flowInvocationsObserver      func(*metrics.MetricData)
	requestsThroughFlowsObserver func(*metrics.MetricData)
	processorExecutionObserver   func(*metrics.MetricData)

	totalFlowExecutionsPerFlow      map[string]int64 // key - flow ID,value: total num of executions
	totalFlowExecutionTimeNsPerFlow map[string]int64 // key - flow ID,value: total exec time,nano secs

	avgFlowExecutionTimePerFlow sync.Map // key - flow ID, value - average execution time, float64
	procMetricsData             sync.Map // key - processor key, value - *ProcessorMetricsData

	// buffered channels to handle flow invocation events and release caller quickly
	flowInvocationEvents chan flowInvocationEvent
	requestsThroughFlows chan flowInvocationEvent
	flowDurationEvents   chan flowDurationEvent
}

type ProcessorMetricsData struct {
	avgProcExecTimeMu             sync.RWMutex
	avgProcessorExecutionTime     float64
	totalProcessorExecutions      int64
	totalProcessorExecutionTimeNs int64

	// buffered channel to handle processor execution events and release caller quickly
	processorExecutionEvents chan procExecutionEvent
}

type flowInvocationEvent struct {
	FlowName string
	StreamID string
	LabelSet *metrics.LabelSet
}

type flowDurationEvent struct {
	FlowName string
	Duration time.Duration
}

type procExecutionEvent struct {
	FlowName string
	StreamID string
	Success  bool
	Duration time.Duration
	LabelSet *metrics.LabelSet
}
