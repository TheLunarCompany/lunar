package runner

import (
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/config"
	"lunar/engine/messages"
	"lunar/engine/services"
	"lunar/engine/services/diagnoses"
	sharedActions "lunar/shared-model/actions"
	sharedConfig "lunar/shared-model/config"

	"github.com/rs/zerolog/log"
)

const (
	unknownRemedyError = "Error running OnResponse for remedy [%+v]. " +
		"Unknown or undefined remedy type: %v"
)

type runResult[A any, R any] struct {
	action         A
	activeRemedies map[sharedConfig.RemedyType][]R
}

type (
	requestRunResult  runResult[actions.ReqLunarAction, sharedActions.RemedyReqRunResult]   //nolint:lll
	responseRunResult runResult[actions.RespLunarAction, sharedActions.RemedyRespRunResult] //nolint:lll
)

func runOnRequest(
	args messages.OnRequest,
	remedies []config.ScopedRemedy,
	services *services.RemedyPlugins,
	accounts map[sharedConfig.AccountID]sharedConfig.Account,
) (requestRunResult, error) {
	var prioritizedAction actions.ReqLunarAction = &actions.NoOpAction{}
	activeRemedies := map[sharedConfig.RemedyType][]sharedActions.RemedyReqRunResult{} //nolint:lll
	for _, remedy := range remedies {
		action, err := remedyOnRequest(args, remedy, accounts, services)
		if err != nil {
			return requestRunResult{
				action:         nil,
				activeRemedies: map[sharedConfig.RemedyType][]sharedActions.RemedyReqRunResult{}, //nolint:lll
			}, err
		}

		if action.ReqRunResult() != sharedActions.ReqNoOp {
			activeRemedies[remedy.Remedy.Type()] = append(
				activeRemedies[remedy.Remedy.Type()],
				action.ReqRunResult(),
			)
		}
		action.EnsureRequestIsUpdated(&args)
		prioritizedAction = prioritizedAction.ReqPrioritize(action)
	}
	return requestRunResult{
		action:         prioritizedAction,
		activeRemedies: activeRemedies,
	}, nil
}

func runOnResponse(
	args messages.OnResponse,
	remedies []config.ScopedRemedy,
	services *services.RemedyPlugins,
) (responseRunResult, error) {
	var prioritizedAction actions.RespLunarAction = &actions.NoOpAction{}
	activeRemedies := map[sharedConfig.RemedyType][]sharedActions.RemedyRespRunResult{} //nolint:lll
	for _, remedy := range remedies {
		action, err := remedyOnResponse(args, remedy, services)
		if err != nil {
			return responseRunResult{
				action:         nil,
				activeRemedies: map[sharedConfig.RemedyType][]sharedActions.RemedyRespRunResult{}, //nolint:lll
			}, err
		}

		if action.RespRunResult() != sharedActions.RespNoOp {
			activeRemedies[remedy.Remedy.Type()] = append(
				activeRemedies[remedy.Remedy.Type()],
				action.RespRunResult(),
			)
		}

		action.EnsureResponseIsUpdated(&args)
		prioritizedAction = prioritizedAction.RespPrioritize(action)
	}

	return responseRunResult{
		action:         prioritizedAction,
		activeRemedies: activeRemedies,
	}, nil
}

func runOnTransaction(
	onRequest messages.OnRequest,
	onResponse messages.OnResponse,
	diagnoses []*config.ScopedDiagnosis,
	services *services.DiagnosisPlugins,
	exporters *services.Exporters,
	policyTree *config.EndpointPolicyTree,
) {
	for _, diagnosis := range diagnoses {
		output := diagnosisOnTransaction(
			onRequest,
			onResponse,
			diagnosis,
			services,
			policyTree,
		)
		if output == nil {
			log.Debug().
				Msg("could not obtain diagnosis output, will not export anything")
			return
		}
		exportDiagnosisOutput(output, diagnosis, exporters)
	}
}

func remedyOnRequest(
	args messages.OnRequest,
	scopedRemedy config.ScopedRemedy,
	accounts map[sharedConfig.AccountID]sharedConfig.Account,
	services *services.RemedyPlugins,
) (actions.ReqLunarAction, error) {
	remedy := scopedRemedy.Remedy
	switch remedyType := remedy.Type(); remedyType {

	case sharedConfig.RemedyCaching:
		return services.CachingPlugin.OnRequest(
			args, remedy.Config.Caching, scopedRemedy.PathParams)

	case sharedConfig.RemedyResponseBasedThrottling:
		return services.ResponseBasedThrottlingPlugin.OnRequest(
			args,
			remedy.Config.ResponseBasedThrottling,
		)

	case sharedConfig.RemedyStrategyBasedThrottling:
		return services.StrategyBasedThrottlingPlugin.OnRequest(
			args,
			scopedRemedy,
		)

	case sharedConfig.RemedyConcurrencyBasedThrottling:
		return services.ConcurrencyBasedThrottlingPlugin.OnRequest(
			args,
			scopedRemedy,
		)
	case sharedConfig.RemedyStrategyBasedQueue:
		return services.StrategyBasedQueuePlugin.OnRequest(args, scopedRemedy)
	case sharedConfig.RemedyAccountOrchestration:
		return services.AccountOrchestrationPlugin.OnRequest(
			args,
			remedy.Config.AccountOrchestration,
			accounts,
		)

	case sharedConfig.RemedyFixedResponse:
		return services.FixedResponsePlugin.OnRequest(
			args,
			remedy.Config.FixedResponse,
		)

	case sharedConfig.RemedyRetry:
		return services.RetryPlugin.OnRequest(args, remedy.Config.Retry)

	case sharedConfig.RemedyAuth:
		return services.AuthPlugin.OnRequest(
			args,
			scopedRemedy,
			accounts,
		)

	case sharedConfig.RemedyUndefined:
		return nil,
			fmt.Errorf(unknownRemedyError, remedy, remedyType)
	default:
		return nil,
			fmt.Errorf(unknownRemedyError, remedy, remedyType)
	}
}

func remedyOnResponse(
	args messages.OnResponse,
	scopedRemedy config.ScopedRemedy,
	services *services.RemedyPlugins,
) (actions.RespLunarAction, error) {
	remedy := scopedRemedy.Remedy
	switch remedyType := remedy.Type(); remedyType {

	case sharedConfig.RemedyCaching:
		return services.CachingPlugin.OnResponse(args, remedy.Config.Caching,
			scopedRemedy.PathParams)

	case sharedConfig.RemedyResponseBasedThrottling:
		return services.ResponseBasedThrottlingPlugin.OnResponse(
			args,
			remedy.Config.ResponseBasedThrottling,
		)

	case sharedConfig.RemedyStrategyBasedThrottling:
		return services.StrategyBasedThrottlingPlugin.OnResponse(
			args,
			scopedRemedy,
		)
	case sharedConfig.RemedyConcurrencyBasedThrottling:
		return services.ConcurrencyBasedThrottlingPlugin.OnResponse(
			args,
			scopedRemedy,
		)
	case sharedConfig.RemedyStrategyBasedQueue:
		return services.StrategyBasedQueuePlugin.OnResponse(args, scopedRemedy)
	case sharedConfig.RemedyAccountOrchestration:
		return services.AccountOrchestrationPlugin.OnResponse(
			args,
			remedy.Config.AccountOrchestration,
		)

	case sharedConfig.RemedyFixedResponse:
		return services.FixedResponsePlugin.OnResponse(
			args,
			remedy.Config.FixedResponse,
		)
	case sharedConfig.RemedyRetry:
		return services.RetryPlugin.OnResponse(args, remedy.Config.Retry)

	case sharedConfig.RemedyAuth:
		return services.AuthPlugin.OnResponse()
	case sharedConfig.RemedyUndefined:
		return nil, fmt.Errorf(unknownRemedyError, remedy, remedyType)
	default:
		return nil, fmt.Errorf(unknownRemedyError, remedy, remedyType)
	}
}

func diagnosisOnTransaction(
	onRequest messages.OnRequest,
	onResponse messages.OnResponse,
	scopedDiagnosis *config.ScopedDiagnosis,
	diagnosisPlugins *services.DiagnosisPlugins,
	policyTree *config.EndpointPolicyTree,
) *diagnoses.DiagnosisOutput {
	var err error
	var diagnosisOutput *diagnoses.DiagnosisOutput
	switch diagnosisType := scopedDiagnosis.Diagnosis.Type(); diagnosisType {
	case sharedConfig.DiagnosisHARExporter:
		diagnosisOutput, err = diagnosisPlugins.HARGeneratorPlugin.OnTransaction(
			onRequest,
			onResponse,
			policyTree,
			scopedDiagnosis,
		)
		if err != nil {
			log.Error().
				Err(err).
				Msg("Failed to run HARGenerator diagnosis plugin")
		}
	case sharedConfig.DiagnosisMetricsCollector:
		diagnosisOutput, err = diagnosisPlugins.MetricsCollector.OnTransaction(
			onRequest,
			onResponse,
			policyTree,
			scopedDiagnosis,
		)
		if err != nil {
			log.Error().
				Err(err).
				Msg("Failed to run MetricsCollector diagnosis plugin")
		}
	case sharedConfig.DiagnosisVoid:
		diagnosisOutput, err = diagnosisPlugins.Void.OnTransaction(
			onRequest,
			onResponse,
			policyTree,
			scopedDiagnosis,
		)
		if err != nil {
			log.Error().
				Err(err).
				Msg("Failed to run Void diagnosis plugin")
		}
	case sharedConfig.DiagnosisUndefined:
		log.Warn().Msgf("Error running OnTransaction for diagnosis [%+v]. "+
			"Unknown or undefined type: %v", scopedDiagnosis, diagnosisType)
	}

	return diagnosisOutput
}

func exportDiagnosisOutput(
	diagnosisOutput *diagnoses.DiagnosisOutput,
	diagnosis *config.ScopedDiagnosis,
	exporter *services.Exporters,
) {
	var err error
	exporterType := diagnosis.Diagnosis.ExporterType()
	switch diagnosis.Diagnosis.ExporterKind() {
	case sharedConfig.ExporterKindRawData:
		err = exporter.Content.Export(*diagnosisOutput, exporterType)
	case sharedConfig.ExporterKindMetrics:
		err = exporter.Prometheus.Export(*diagnosisOutput)
	case sharedConfig.ExporterKindUndefined:
		log.Error().
			Msg("Diagnosis has no exporter defined, will not export output")
	}

	if err != nil {
		log.Error().Err(err).
			Msgf("Failed to export output from diagnosis %v", diagnosis.Diagnosis.Name)
	}
}
