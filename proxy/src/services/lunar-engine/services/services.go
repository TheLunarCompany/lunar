package services

import (
	"lunar/engine/services/diagnoses"
	"lunar/engine/services/exporters"
	"lunar/engine/services/remedies"
	"lunar/engine/utils/obfuscation"
	"lunar/engine/utils/writers"
	"lunar/toolkit-core/clock"
	"time"
)

func InitializeServices(
	clock clock.Clock,
	syslogWriter writers.Writer,
	proxyTimeout time.Duration,
) *Services {
	md5Obfuscator := obfuscation.Obfuscator{Hasher: obfuscation.MD5Hasher{}}
	return &Services{
		Remedies: RemedyPlugins{
			FixedResponsePlugin: remedies.NewFixedResponsePlugin(clock),
			ResponseBasedThrottlingPlugin: remedies.NewResponseBasedThrottlingPlugin(
				clock,
			),
			StrategyBasedThrottlingPlugin: remedies.NewStrategyBasedThrottlingPlugin(
				clock,
			),
			ConcurrencyBasedThrottlingPlugin: remedies.NewConcurrencyBasedThrottlingPlugin( //nolint:lll
				clock,
				proxyTimeout,
			),
			AccountOrchestrationPlugin: remedies.NewAccountOrchestrationPlugin(),
			RetryPlugin:                remedies.NewRetryPlugin(clock),
			AuthPlugin:                 remedies.NewAuthPlugin(),
		},
		Diagnosis: DiagnosisPlugins{
			HARGeneratorPlugin: diagnoses.NewHARGeneratorPlugin(
				clock,
				md5Obfuscator,
			),
			MetricsCollector: &diagnoses.MetricsCollectorPlugin{},
			Void:             &diagnoses.VoidPlugin{},
		},
		Exporters: Exporters{
			Content:    *exporters.NewRawDataExporter(syslogWriter),
			Prometheus: exporters.PrometheusExporter{},
		},
	}
}
