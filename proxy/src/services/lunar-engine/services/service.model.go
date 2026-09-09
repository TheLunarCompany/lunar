package services

import (
	"lunar/engine/services/diagnoses"
	"lunar/engine/services/exporters"
	"lunar/engine/services/remedies"
)

type RemedyPlugins struct {
	FixedResponsePlugin              *remedies.FixedResponsePlugin
	ResponseBasedThrottlingPlugin    *remedies.ResponseBasedThrottlingPlugin
	StrategyBasedThrottlingPlugin    *remedies.StrategyBasedThrottlingPlugin
	ConcurrencyBasedThrottlingPlugin *remedies.ConcurrencyBasedThrottlingPlugin
	StrategyBasedQueuePlugin         *remedies.StrategyBasedQueuePlugin
	AccountOrchestrationPlugin       *remedies.AccountOrchestrationPlugin
	RetryPlugin                      *remedies.RetryPlugin
	AuthPlugin                       *remedies.AuthPlugin
	CachingPlugin                    *remedies.CachingPlugin
}

type DiagnosisPlugins struct {
	HARGeneratorPlugin *diagnoses.HARGeneratorPlugin
	MetricsCollector   *diagnoses.MetricsCollectorPlugin
	Void               *diagnoses.VoidPlugin
}

type Exporters struct {
	Content    exporters.RawDataExporter
	Prometheus exporters.PrometheusExporter
}

type PoliciesServices struct {
	Remedies  RemedyPlugins
	Diagnosis DiagnosisPlugins
	Exporters Exporters
}
