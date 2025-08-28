package services

import (
	"context"
	"lunar/engine/services/diagnoses"
	"lunar/engine/services/exporters"
	"lunar/engine/services/remedies"
	"lunar/engine/utils/limit"
	"lunar/engine/utils/obfuscation"
	"lunar/engine/utils/writers"
	"lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/logging"
	"lunar/toolkit-core/otel"
	"time"
)

func initializeServices(
	clock clock.Clock,
	syslogWriter writers.Writer,
	contextLogger logging.ContextLogger,
	proxyTimeout time.Duration,
	rateLimitState limit.IncrementableRateLimitState,
	delayedPriorityQueueFactory remedies.InitializeQueueFunc,
	exportersConfig config.Exporters,
) (*PoliciesServices, error) {
	md5Obfuscator := obfuscation.Obfuscator{Hasher: obfuscation.MD5Hasher{}}
	identityObfuscator := obfuscation.Obfuscator{
		Hasher: obfuscation.IdentityHasher{},
	}
	ctx := context.Background()

	prometheusConfig := config.PrometheusConfig{}
	if exportersConfig.Prometheus != nil {
		prometheusConfig = *exportersConfig.Prometheus
	}
	meter := otel.GetMeter()

	strategyBasedThrottlingPlugin, err := remedies.NewStrategyBasedThrottlingPlugin(
		ctx,
		clock,
		meter,
		rateLimitState,
		identityObfuscator,
	)
	if err != nil {
		return nil, err
	}

	return &PoliciesServices{
		Remedies: RemedyPlugins{
			FixedResponsePlugin: remedies.NewFixedResponsePlugin(clock),
			ResponseBasedThrottlingPlugin: remedies.NewResponseBasedThrottlingPlugin(
				clock,
			),
			StrategyBasedThrottlingPlugin: strategyBasedThrottlingPlugin,
			ConcurrencyBasedThrottlingPlugin: remedies.NewConcurrencyBasedThrottlingPlugin(
				clock,
				proxyTimeout,
			),
			StrategyBasedQueuePlugin: remedies.NewStrategyBasedQueuePlugin(
				ctx,
				clock,
				contextLogger,
				meter,
				delayedPriorityQueueFactory,
			),
			AccountOrchestrationPlugin: remedies.NewAccountOrchestrationPlugin(),
			RetryPlugin:                remedies.NewRetryPlugin(clock),
			AuthPlugin:                 remedies.NewAuthPlugin(),
			CachingPlugin:              remedies.NewCachingPlugin(clock),
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
			Prometheus: *exporters.NewPrometheusExporter(ctx, meter, prometheusConfig),
		},
	}, nil
}
