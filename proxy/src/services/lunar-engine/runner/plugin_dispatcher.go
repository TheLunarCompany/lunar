package runner

import (
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/config"
	"lunar/engine/messages"
	"lunar/engine/services"
	"lunar/engine/utils"
	sharedActions "lunar/shared-model/actions"
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
	reqRunResult, err := runOnRequest(
		onRequest, remedies, &services.Remedies, policiesConfig.Accounts)

	reqRunResult.action.EnsureRequestIsUpdated(&onRequest)

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

	spoeActions := []spoe.Action{}

	if reqRunResult.action.ReqRunResult() == sharedActions.ReqObtainedResponse {
		modifiedEarlyResponse, err := obtainModifiedEarlyResponse(
			onRequest,
			policyTree,
			policiesConfig,
			services,
			diagnosisWorker,
			reqRunResult,
		)
		if err != nil {
			log.Error().Err(err).Msg("Could not modify response for" +
				"early response")
		}

		reqRunResult = modifiedEarlyResponse.modifiedRequestRunResult
		spoeActions = append(spoeActions, modifiedEarlyResponse.spoeActions...)
	}

	spoeActions = append(spoeActions, reqRunResult.action.ReqToSpoeActions()...)
	spoeActions = append(spoeActions, buildActiveRemediesSPOEAction(
		reqRunResult.activeRemedies, requestActiveRemedies))
	return spoeActions, nil
}

type modifiedEarlyResponse struct {
	modifiedRequestRunResult requestRunResult
	spoeActions              []spoe.Action
}

func obtainModifiedEarlyResponse(
	onRequest messages.OnRequest,
	policyTree *config.EndpointPolicyTree,
	policiesConfig *sharedConfig.PoliciesConfig,
	services *services.Services,
	diagnosisWorker *DiagnosisWorker,
	initialReqRunResult requestRunResult,
) (*modifiedEarlyResponse, error) {
	earlyResponseAction, valid := initialReqRunResult.action.(*actions.EarlyResponseAction) //nolint:lll
	if !valid {
		err := fmt.Errorf("Request Early Response: could not convert" +
			"ReqObtainedResponse action into EarlyResponseAction")
		return nil, err
	}
	onResponse := messages.OnResponse{
		ID:         onRequest.ID,
		SequenceID: onRequest.SequenceID,
		Method:     onRequest.Method,
		URL:        onRequest.URL,
		Status:     earlyResponseAction.Status,
		Headers:    earlyResponseAction.Headers,
		Body:       earlyResponseAction.Body,
		Time:       onRequest.Time,
	}

	respRunResult, err := getOnResponseRunResult(
		onResponse,
		policyTree,
		&policiesConfig.Global,
		services,
		diagnosisWorker,
	)
	if err != nil {
		err := fmt.Errorf("Request Early Response:" +
			"calling DispatchOnResponse failed")
		return nil, err
	}
	if respRunResult.action.RespRunResult() == sharedActions.RespModifiedResponse { //nolint:lll
		// using the now-modified onResponse to rebuild EarlyResponseAction
		modifiedEarlyResponseAction := actions.EarlyResponseAction{
			Status:  onResponse.Status,
			Headers: onResponse.Headers,
			Body:    onResponse.Body,
		}

		initialReqRunResult.action = &modifiedEarlyResponseAction
		spoeAction := buildActiveRemediesSPOEAction(
			respRunResult.activeRemedies,
			responseActiveRemedies,
		)

		return &modifiedEarlyResponse{
			modifiedRequestRunResult: initialReqRunResult,
			spoeActions:              []spoe.Action{spoeAction},
		}, nil
	}

	return &modifiedEarlyResponse{
		modifiedRequestRunResult: initialReqRunResult,
		spoeActions:              []spoe.Action{},
	}, nil
}

func DispatchOnResponse(
	onResponse messages.OnResponse,
	policyTree *config.EndpointPolicyTree,
	globalPolicies *sharedConfig.Global,
	services *services.Services,
	diagnosisWorker *DiagnosisWorker,
) ([]spoe.Action, error) {
	runResult, err := getOnResponseRunResult(
		onResponse, policyTree, globalPolicies, services, diagnosisWorker)
	if err != nil {
		log.Error().
			Stack().Err(err).
			Msgf("Failed to obtain actions.LunarAction for OnResponse, error: %+v", err)
		return []spoe.Action{}, err
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

func getOnResponseRunResult(
	onResponse messages.OnResponse,
	policyTree *config.EndpointPolicyTree,
	globalPolicies *sharedConfig.Global,
	services *services.Services,
	diagnosisWorker *DiagnosisWorker,
) (responseRunResult, error) {
	scopedRemedies := getRemedies(
		onResponse.Method, onResponse.URL, policyTree, globalPolicies)
	runResult, err := runOnResponse(
		onResponse, scopedRemedies, &services.Remedies)
	if err != nil {
		return responseRunResult{}, err
	}

	if shouldDiagnose(
		onResponse.Method, onResponse.URL, policyTree, globalPolicies) {
		diagnosisWorker.AddResponseToTask(onResponse)
		diagnosisWorker.NotifyTaskReady(onResponse.ID)
	}

	return runResult, nil
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
