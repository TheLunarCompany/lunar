package runner

import (
	"lunar/engine/config"
	"lunar/engine/messages"
	"lunar/engine/services"
	"lunar/engine/utils"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/urltree"

	"github.com/goccy/go-json"
	"github.com/rs/zerolog/log"

	spoe "github.com/TheLunarCompany/haproxy-spoe-go"
)

type activeRemediesActionName int

const (
	requestActiveRemedies activeRemediesActionName = iota
	responseActiveRemedies
)

func (a *activeRemediesActionName) String() string {
	var res string
	switch *a {
	case requestActiveRemedies:
		res = "request_active_remedies"
	case responseActiveRemedies:
		res = "response_active_remedies"
	}

	return res
}

func DispatchOnRequest(
	onRequest messages.OnRequest,
	policyTree *config.EndpointPolicyTree,
	policiesConfig *sharedConfig.PoliciesConfig,
	services *services.Services,
	diagnosisWorker *DiagnosisWorker,
) ([]spoe.Action, error) {
	remedies := getRemedies(
		onRequest.Method, onRequest.URL, policyTree, &policiesConfig.Global)
	runResult, err := runOnRequest(
		onRequest, remedies, &services.Remedies, policiesConfig.Accounts)

	runResult.action.EnsureRequestIsUpdated(&onRequest)

	if shouldDiagnose(
		onRequest.Method,
		onRequest.URL,
		policyTree,
		&policiesConfig.Global,
	) {
		diagnosisWorker.AddRequestToTask(onRequest)
	}

	if err != nil {
		log.Error().
			Stack().Err(err).
			Msgf("Failed to obtain actions.LunarAction for OnRequest, error: %v", err)
		return nil, err
	}

	spoeActions := append(
		runResult.action.ReqToSpoeActions(),
		buildActiveRemediesSPOEAction(
			runResult.activeRemedies,
			requestActiveRemedies,
		),
	)

	return spoeActions, nil
}

func DispatchOnResponse(
	onResponse messages.OnResponse,
	policyTree *config.EndpointPolicyTree,
	globalPolicies *sharedConfig.Global,
	services *services.Services,
	diagnosisWorker *DiagnosisWorker,
) ([]spoe.Action, error) {
	scopedRemedies := getRemedies(
		onResponse.Method, onResponse.URL, policyTree, globalPolicies)
	runResult, err := runOnResponse(
		onResponse,
		scopedRemedies,
		&services.Remedies,
	)

	if shouldDiagnose(
		onResponse.Method, onResponse.URL, policyTree, globalPolicies) {
		diagnosisWorker.AddResponseToTask(onResponse)
		diagnosisWorker.NotifyTaskReady(onResponse.ID)
	}
	if err != nil {
		log.Error().
			Stack().Err(err).
			Msgf("Failed to obtain actions.LunarAction for OnResponse, error: %+v", err)
	}

	spoeActions := append(
		runResult.action.RespToSpoeActions(),
		buildActiveRemediesSPOEAction(
			runResult.activeRemedies,
			responseActiveRemedies,
		),
	)
	return spoeActions, nil
}

func buildActiveRemediesSPOEAction[T any](
	activeRemedies map[sharedConfig.RemedyType][]T,
	actionName activeRemediesActionName,
) spoe.Action {
	json, _ := json.Marshal(activeRemedies)
	return spoe.ActionSetVar{
		Name:  actionName.String(),
		Scope: spoe.VarScopeTransaction,
		Value: json,
	}
}

func getRemedies(
	methodStr string,
	url string,
	policyTree *config.EndpointPolicyTree,
	globalPolicies *sharedConfig.Global,
) []config.ScopedRemedy {
	var scopedRemedies []config.ScopedRemedy

	log.Debug().Msgf("Filtering remedies for: %v %v", methodStr, url)

	lookupResult := policyTree.Lookup(url)
	if lookupResult.Value != nil {
		methodToEndpointPolicy := *lookupResult.Value
		method := urltree.Method(methodStr)
		if policy, found := methodToEndpointPolicy[method]; found {
			scopedRemedies = appendEndpointRemedies(
				policy.Remedies,
				scopedRemedies,
				methodStr,
				lookupResult.NormalizedURL,
			)
		}
	}

	scopedRemedies = appendGlobalRemedies(
		globalPolicies.Remedies, scopedRemedies)
	log.Debug().Msgf(
		"Found %v remedies for: %v %v", len(scopedRemedies), methodStr, url)
	if log.Debug().Enabled() {
		for _, scopedRemedy := range scopedRemedies {
			log.Debug().Msgf(
				"Remedy %v config: %+v",
				scopedRemedy.Remedy.Name,
				scopedRemedy.Remedy.Config,
			)
		}
	}
	return scopedRemedies
}

func getDiagnoses(
	methodStr string,
	url string,
	policyTree *config.EndpointPolicyTree,
	globalDiagnoses []sharedConfig.Diagnosis,
) []*config.ScopedDiagnosis {
	var scopedDiagnoses []*config.ScopedDiagnosis

	log.Debug().Msgf("Filtering diagnoses for: %v %v", methodStr, url)

	lookupResult := policyTree.Lookup(url)
	if lookupResult.Value != nil {
		methodToEndpointPolicy := *lookupResult.Value
		method := urltree.Method(methodStr)
		if policy, found := methodToEndpointPolicy[method]; found {
			scopedDiagnoses = appendEndpointDiagnoses(
				policy.Diagnosis,
				scopedDiagnoses,
				methodStr,
				lookupResult.NormalizedURL,
			)
		}
	}

	scopedDiagnoses = appendGlobalDiagnoses(
		globalDiagnoses,
		scopedDiagnoses,
	)
	return scopedDiagnoses
}

// TODO: can we do better with all this iterators-appenders?

func appendEndpointRemedies(
	source []sharedConfig.Remedy,
	target []config.ScopedRemedy,
	method string,
	normalizedURL string,
) []config.ScopedRemedy {
	for idx, plugin := range source {
		if plugin.IsEnabled() {
			log.Debug().Msgf("Applying remedy: \"%v\"", plugin.GetName())

			target = append(target, config.ScopedRemedy{
				Scope:         utils.ScopeEndpoint,
				Method:        method,
				NormalizedURL: normalizedURL,
				Remedy:        &source[idx],
			})
		}
	}
	return target
}

func appendGlobalRemedies(
	source []sharedConfig.Remedy,
	target []config.ScopedRemedy,
) []config.ScopedRemedy {
	for idx, plugin := range source {
		if plugin.IsEnabled() {
			log.Debug().Msgf("Applying remedy: \"%v\"", plugin.GetName())

			target = append(
				target,
				config.ScopedRemedy{ //nolint:exhaustruct
					Scope:  utils.ScopeGlobal,
					Remedy: &source[idx],
				},
			)
		}
	}
	return target
}

func appendEndpointDiagnoses(
	source []sharedConfig.Diagnosis,
	target []*config.ScopedDiagnosis,
	method string,
	normalizedURL string,
) []*config.ScopedDiagnosis {
	for idx, plugin := range source {
		if plugin.IsEnabled() {
			log.Debug().Msgf("Applying diagnosis: \"%v\"", plugin.GetName())

			target = append(
				target,
				&config.ScopedDiagnosis{
					Scope:         utils.ScopeEndpoint,
					Diagnosis:     &source[idx],
					Method:        method,
					NormalizedURL: normalizedURL,
				},
			)
		}
	}
	return target
}

func appendGlobalDiagnoses(
	source []sharedConfig.Diagnosis,
	target []*config.ScopedDiagnosis,
) []*config.ScopedDiagnosis {
	for idx, plugin := range source {
		if plugin.IsEnabled() {
			log.Debug().Msgf("Applying diagnosis: \"%v\"", plugin.GetName())

			target = append(
				target,
				&config.ScopedDiagnosis{ //nolint:exhaustruct
					Scope:     utils.ScopeGlobal,
					Diagnosis: &source[idx],
				},
			)
		}
	}
	return target
}

func shouldDiagnose(
	methodStr string,
	url string,
	policyTree *config.EndpointPolicyTree,
	globalPolicies *sharedConfig.Global,
) bool {
	for _, diagnoses := range globalPolicies.Diagnosis {
		if diagnoses.Enabled {
			return true
		}
	}

	lookupResult := policyTree.Lookup(url)
	if lookupResult.Value == nil {
		log.Debug().Msg("No diagnosis plugins were found")
		return false
	}

	methodToEndpointPolicy := *lookupResult.Value
	method := urltree.Method(methodStr)
	if policy, found := methodToEndpointPolicy[method]; found {
		for _, diagnosis := range policy.Diagnosis {
			if diagnosis.Enabled {
				return true
			}
		}
	}

	log.Debug().Msg("No diagnosis plugins were found")
	return false
}
