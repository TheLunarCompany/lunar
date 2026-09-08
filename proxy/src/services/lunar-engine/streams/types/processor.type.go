package streamtypes

import (
	publictypes "lunar/engine/streams/public-types"
)

type ProcessorRequirement struct {
	IsBodyRequired       bool
	IsReqCaptureRequired bool
}

type ProcessorI interface {
	GetName() string
	Execute(flowName string, apiStream publictypes.APIStreamI) (ProcessorIO, error)
	GetRequirement() *ProcessorRequirement
}

type ProcessorParam struct {
	Name  string
	Value *publictypes.ParamValue
}

type ProcessorMetaData struct {
	Name                string
	ProcessorDefinition ProcessorDefinition
	Parameters          map[string]ProcessorParam
	Metrics             *publictypes.ProcessorMetrics
	Resources           publictypes.ResourceManagementI
	Clock               publictypes.ClockI
	SharedMemory        publictypes.SharedStateI[string]
}

func (p *ProcessorMetaData) IsMetricsEnabled() bool {
	if p.Metrics == nil {
		return false
	}
	return p.Metrics.Enabled
}

func (p *ProcessorMetaData) GetMetricLabels() []string {
	if !p.IsMetricsEnabled() {
		return []string{}
	}
	return p.Metrics.Labels
}
