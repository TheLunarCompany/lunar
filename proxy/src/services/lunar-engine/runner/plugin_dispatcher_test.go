//go:build !pro

package runner_test

import (
	"lunar/engine/config"
	lunarMessages "lunar/engine/messages"
	"lunar/engine/runner"
	"lunar/engine/services"
	sharedActions "lunar/shared-model/actions"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/urltree"
	"testing"

	"github.com/goccy/go-json"
	"github.com/negasus/haproxy-spoe-go/action"
	"github.com/stretchr/testify/assert"
)

var requestActiveRemediesAction = action.Action{
	Name:  "request_active_remedies",
	Scope: action.ScopeTransaction,
	Value: []byte("{}"),
	Type:  action.TypeSetVar,
}

var responseActiveRemediesAction = action.Action{
	Name:  "response_active_remedies",
	Scope: action.ScopeTransaction,
	Value: []byte("{}"),
	Type:  action.TypeSetVar,
}

func TestGivenOnRequestAndNoMatchingPoliciesASingleEmptyActionIsReturned(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	onRequest := lunarMessages.OnRequest{
		ID:         "1234-5678-9012-3456",
		SequenceID: "1234-5678-9012-3456",
		Method:     "GET",
		Scheme:     "http",
		URL:        "twitter.com/post/1234",
		Path:       "/post/1234",
		Query:      "",
		Headers:    map[string]string{"Host": "twitter.com"},
		Body:       "",
		Time:       clock.Now(),
	}
	policyTree := fixedRemedyEndpointPolicyTree()
	globalPolicies := globalPolicies()
	accounts := accounts()
	mockWriter := newMockWriter()
	exporterConfig := sharedConfig.Exporters{}
	services, _ := services.Initialize(
		mockWriter,
		proxyTimeout,
		exporterConfig,
	)
	diagnosisWorker := runner.NewDiagnosisWorker()
	policiesAccessor := config.SimplePolicyAccessor{
		PoliciesData: &config.PoliciesData{
			Config: sharedConfig.PoliciesConfig{
				Global:   *globalPolicies,
				Accounts: accounts,
			},
			EndpointPolicyTree: *policyTree,
		},
	}

	diagnosisWorker.Run(
		&policiesAccessor,
		&services.Diagnosis,
		&services.Exporters,
	)

	actions, err := runner.DispatchOnRequest(
		onRequest,
		policyTree,
		&policiesAccessor.PoliciesData.Config,
		services,
		diagnosisWorker,
	)

	assert.Nil(t, err)
	wantedActions := action.Actions{requestActiveRemediesAction}
	assert.Equal(t, wantedActions, actions)
}

func TestGivenOnRequestAndGlobalFixedResponseRemedyWithoutHeaderASingleEmptyActionIsReturned(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	onRequest := lunarMessages.OnRequest{
		ID:         "1234-5678-9012-3456",
		SequenceID: "1234-5678-9012-3456",
		Method:     "GET",
		Scheme:     "http",
		URL:        "twitter.com/user/1234",
		Path:       "/user/1234",
		Query:      "",
		Headers:    map[string]string{"Host": "twitter.com"},
		Body:       "",
		Time:       clock.Now(),
	}
	policyTree := fixedRemedyEndpointPolicyTree()
	globalPolicies := globalPoliciesWithFixedResponseRemedy()
	accounts := accounts()
	mockWriter := newMockWriter()

	exporterConfig := sharedConfig.Exporters{}
	services, _ := services.Initialize(
		mockWriter,
		proxyTimeout,
		exporterConfig,
	)
	diagnosisWorker := runner.NewDiagnosisWorker()
	policiesAccessor := config.SimplePolicyAccessor{
		PoliciesData: &config.PoliciesData{
			Config: sharedConfig.PoliciesConfig{
				Global:   *globalPolicies,
				Accounts: accounts,
			},
			EndpointPolicyTree: *policyTree,
		},
	}

	diagnosisWorker.Run(
		&policiesAccessor,
		&services.Diagnosis,
		&services.Exporters,
	)

	actions, err := runner.DispatchOnRequest(
		onRequest,
		policyTree,
		&policiesAccessor.PoliciesData.Config,
		services,
		diagnosisWorker,
	)

	assert.Nil(t, err)
	wantedActions := action.Actions{requestActiveRemediesAction}
	assert.Equal(t, wantedActions, actions)
}

func TestGivenOnRequestAndGlobalFixedResponseRemedyWithHeaderEarlyResponseActionsAreReturned(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	onRequest := lunarMessages.OnRequest{
		ID:         "1234-5678-9012-3456",
		SequenceID: "1234-5678-9012-3456",
		Method:     "GET",
		Scheme:     "http",
		URL:        "twitter.com/user/1234",
		Path:       "/user/1234",
		Query:      "",
		Headers: map[string]string{
			"host":           "twitter.com",
			"early-response": "true",
		},
		Body: "",
		Time: clock.Now(),
	}
	policyTree := fixedRemedyEndpointPolicyTree()
	globalPolicies := globalPoliciesWithFixedResponseRemedy()
	accounts := accounts()
	mockWriter := newMockWriter()

	exporterConfig := sharedConfig.Exporters{}
	services, _ := services.Initialize(
		mockWriter,
		proxyTimeout,
		exporterConfig,
	)
	diagnosisWorker := runner.NewDiagnosisWorker()
	policiesAccessor := config.SimplePolicyAccessor{
		PoliciesData: &config.PoliciesData{
			Config: sharedConfig.PoliciesConfig{
				Global:   *globalPolicies,
				Accounts: accounts,
			},
			EndpointPolicyTree: *policyTree,
		},
	}

	diagnosisWorker.Run(
		&policiesAccessor,
		&services.Diagnosis,
		&services.Exporters,
	)

	actions, err := runner.DispatchOnRequest(
		onRequest,
		policyTree,
		&policiesAccessor.PoliciesData.Config,
		services,
		diagnosisWorker,
	)
	assert.Nil(t, err)

	wantActions := fixedEarlyResponseActions()
	assert.Equal(t, wantActions, actions)
}

func TestGivenOnRequestAndAMatchingFixedResponseRemedyWithHeaderEarlyResponseActionsAreReturned(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	onRequest := lunarMessages.OnRequest{
		ID:         "1234-5678-9012-3456",
		SequenceID: "1234-5678-9012-3456",
		Method:     "GET",
		Scheme:     "http",
		URL:        "twitter.com/user/1234/messages",
		Path:       "/user/1234/messages",
		Query:      "",
		Headers: map[string]string{
			"host":           "twitter.com",
			"early-response": "true",
		},
		Body: "",
		Time: clock.Now(),
	}
	policyTree := fixedRemedyEndpointPolicyTree()
	globalPolicies := globalPolicies()
	accounts := accounts()
	mockWriter := newMockWriter()

	exporterConfig := sharedConfig.Exporters{}
	services, _ := services.Initialize(
		mockWriter,
		proxyTimeout,
		exporterConfig,
	)
	diagnosisWorker := runner.NewDiagnosisWorker()
	policiesAccessor := config.SimplePolicyAccessor{
		PoliciesData: &config.PoliciesData{
			Config: sharedConfig.PoliciesConfig{
				Global:   *globalPolicies,
				Accounts: accounts,
			},
			EndpointPolicyTree: *policyTree,
		},
	}

	diagnosisWorker.Run(
		&policiesAccessor,
		&services.Diagnosis,
		&services.Exporters,
	)

	actions, err := runner.DispatchOnRequest(
		onRequest,
		policyTree,
		&policiesAccessor.PoliciesData.Config,
		services,
		diagnosisWorker,
	)
	assert.Nil(t, err)

	wantActions := fixedEarlyResponseActions()
	assert.Equal(t, wantActions, actions)
}

func TestGivenOnResponseASingleNilErrorIsNil(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	onResponse := lunarMessages.OnResponse{
		ID:         "1234-5678-9012-3456",
		SequenceID: "3333-5678-9012-3456",
		Method:     "GET",
		URL:        "twitter.com/user/1234/messages",
		Headers: map[string]string{
			"host":           "twitter.com",
			"early-response": "true",
		},
		Status: 200,
		Body:   "",
		Time:   clock.Now(),
	}
	policyTree := fixedRemedyEndpointPolicyTree()
	globalPolicies := globalPolicies()
	mockWriter := newMockWriter()

	exporterConfig := sharedConfig.Exporters{}
	services, _ := services.Initialize(
		mockWriter,
		proxyTimeout,
		exporterConfig,
	)
	diagnosisWorker := runner.NewDiagnosisWorker()

	policiesAccessor := config.SimplePolicyAccessor{
		PoliciesData: &config.PoliciesData{
			Config: sharedConfig.PoliciesConfig{
				Global: *globalPolicies,
			},
			EndpointPolicyTree: *policyTree,
		},
	}

	diagnosisWorker.Run(
		&policiesAccessor,
		&services.Diagnosis,
		&services.Exporters,
	)

	actions, err := runner.DispatchOnResponse(
		onResponse,
		policyTree,
		globalPolicies,
		services,
		diagnosisWorker,
	)

	assert.Nil(t, err)
	wantedActions := action.Actions{responseActiveRemediesAction}
	assert.Equal(t, wantedActions, actions)
}

func TestGivenMultipleGlobalRemediesWhenOnRequestIsCalledItReturnsOnlyEnabledRemedies(
	t *testing.T,
) {
	t.Skip("Skipping test as it is flaky")

	t.Parallel()
	clock := clock.NewMockClock()
	onRequest := lunarMessages.OnRequest{
		ID:         "1234-5678-9012-3456",
		SequenceID: "1234-5678-9012-3456",
		Method:     "GET",
		Scheme:     "http",
		URL:        "no_specific_endpoint.com/foo/bar",
		Path:       "/foo/bar",
		Query:      "",
		Headers: map[string]string{
			"host":           "no_specific_endpoint.com",
			"early-response": "true",
		},
		Body: "",
		Time: clock.Now(),
	}
	policyTree := fixedRemedyEndpointPolicyTree()
	globalPolicies := globalPoliciesWithMultipleRemedies()

	accounts := accounts()
	mockWriter := newMockWriter()

	exporterConfig := sharedConfig.Exporters{}
	services, _ := services.Initialize(
		mockWriter,
		proxyTimeout,
		exporterConfig,
	)
	diagnosisWorker := runner.NewDiagnosisWorker()
	policiesAccessor := config.SimplePolicyAccessor{
		PoliciesData: &config.PoliciesData{
			Config: sharedConfig.PoliciesConfig{
				Global:   *globalPolicies,
				Accounts: accounts,
			},
			EndpointPolicyTree: *policyTree,
		},
	}

	diagnosisWorker.Run(
		&policiesAccessor,
		&services.Diagnosis,
		&services.Exporters,
	)

	actions, err := runner.DispatchOnRequest(
		onRequest,
		policyTree,
		&policiesAccessor.PoliciesData.Config,
		services,
		diagnosisWorker,
	)
	assert.Nil(t, err)
	assert.Equal(t, fixedEarlyResponseActions(), actions)
}

func fixedEarlyResponseActions() action.Actions {
	requestActiveRemedies := map[sharedConfig.RemedyType][]sharedActions.RemedyReqRunResult{
		sharedConfig.RemedyFixedResponse: {
			sharedActions.ReqObtainedResponse,
		},
	}
	requestActiveRemediesJSON, _ := json.Marshal(requestActiveRemedies)
	wantActions := action.Actions{
		action.Action{
			Name:  "return_early_response",
			Scope: action.ScopeTransaction,
			Value: true,
			Type:  action.TypeSetVar,
		},
		action.Action{
			Name:  "status_code",
			Scope: action.ScopeTransaction,
			Value: 418,
			Type:  action.TypeSetVar,
		},
		action.Action{
			Name:  "response_body",
			Scope: action.ScopeTransaction,
			Value: []byte("{\"message\": \"GO Lunar\"}"),
			Type:  action.TypeSetVar,
		},
		action.Action{
			Name:  "response_headers",
			Scope: action.ScopeTransaction,
			Value: "powered-by:Lunar Interventions Inc.\n",
			Type:  action.TypeSetVar,
		},
		action.Action{
			Name:  "request_active_remedies",
			Scope: action.ScopeTransaction,
			Value: requestActiveRemediesJSON,
			Type:  action.TypeSetVar,
		},
	}
	return wantActions
}

func globalPoliciesWithFixedResponseRemedy() *sharedConfig.Global {
	globalPolicies := &sharedConfig.Global{
		Remedies: []sharedConfig.Remedy{
			{
				Name:    "remedy1",
				Enabled: true,
				Config: sharedConfig.RemedyConfig{
					FixedResponse: &sharedConfig.FixedResponseConfig{
						StatusCode: 418,
					},
				},
			},
		},
		Diagnosis: []sharedConfig.Diagnosis{
			{
				Name:    "diagnosis1",
				Enabled: false,
			},
		},
	}
	return globalPolicies
}

func globalPoliciesWithMultipleRemedies() *sharedConfig.Global {
	globalPolicies := &sharedConfig.Global{
		Remedies: []sharedConfig.Remedy{
			{
				Name:    "remedy1",
				Enabled: true,
				Config: sharedConfig.RemedyConfig{
					FixedResponse: &sharedConfig.FixedResponseConfig{
						StatusCode: 418,
					},
				},
			},
			{
				Name:    "remedy2",
				Enabled: false,
				Config: sharedConfig.RemedyConfig{
					AccountOrchestration: &sharedConfig.AccountOrchestrationConfig{
						RoundRobin: []sharedConfig.AccountID{
							"account1",
							"account2",
						},
					},
				},
			},
		},
		Diagnosis: []sharedConfig.Diagnosis{
			{
				Name:    "diagnosis1",
				Enabled: false,
			},
		},
	}
	return globalPolicies
}

func globalPolicies() *sharedConfig.Global {
	globalPolicies := &sharedConfig.Global{
		Remedies:  []sharedConfig.Remedy{},
		Diagnosis: []sharedConfig.Diagnosis{},
	}
	return globalPolicies
}

func accounts() map[sharedConfig.AccountID]sharedConfig.Account {
	return map[sharedConfig.AccountID]sharedConfig.Account{
		"account1": {
			Tokens: []sharedConfig.Token{
				{
					Header: &sharedConfig.Header{
						Name:  "Authorization",
						Value: "123",
					},
				},
			},
		},
		"account2": {
			Tokens: []sharedConfig.Token{
				{
					Header: &sharedConfig.Header{
						Name:  "Authorization",
						Value: "456",
					},
				},
			},
		},
	}
}

func fixedRemedyEndpointPolicyTree() *urltree.EndpointTree[config.EndpointPolicy] { //
	policyTree, _ := config.BuildEndpointPolicyTree(
		[]sharedConfig.EndpointConfig{
			{
				Method: "GET",
				URL:    "twitter.com/user/1234/messages",
				Remedies: []sharedConfig.Remedy{
					{
						Name:    "remedy1",
						Enabled: true,
						Config: sharedConfig.RemedyConfig{
							FixedResponse: &sharedConfig.FixedResponseConfig{
								StatusCode: 418,
							},
						},
					},
				},
			},
		},
	)
	return policyTree
}

func diagnosisEndpointPolicyTree() *urltree.EndpointTree[config.EndpointPolicy] {
	policyTree, _ := config.BuildEndpointPolicyTree(
		[]sharedConfig.EndpointConfig{
			{
				Method: "GET",
				URL:    "twitter.com/user/1234/messages",
				Diagnosis: []sharedConfig.Diagnosis{
					{
						Name:    "diagnosis1",
						Enabled: true,
						Config: sharedConfig.DiagnosisConfig{
							HARExporter: &sharedConfig.HARExporterConfig{
								TransactionMaxSize: 1000,
								Obfuscate: sharedConfig.Obfuscate{
									Enabled: false,
								},
							},
						},
						Export: "file",
					},
				},
			},
		},
	)
	return policyTree
}

func fixedRemedyAndDiagnosisEndpointPolicyTree() *urltree.EndpointTree[config.EndpointPolicy] {
	policyTree, _ := config.BuildEndpointPolicyTree(
		[]sharedConfig.EndpointConfig{
			{
				Method: "GET",
				URL:    "twitter.com/user/1234/messages",
				Remedies: []sharedConfig.Remedy{
					{
						Name:    "remedy1",
						Enabled: true,
						Config: sharedConfig.RemedyConfig{
							FixedResponse: &sharedConfig.FixedResponseConfig{
								StatusCode: 418,
							},
						},
					},
				},
				Diagnosis: []sharedConfig.Diagnosis{
					{
						Name:    "diagnosis1",
						Enabled: true,
						Config: sharedConfig.DiagnosisConfig{
							HARExporter: &sharedConfig.HARExporterConfig{
								TransactionMaxSize: 1000,
								Obfuscate: sharedConfig.Obfuscate{
									Enabled: false,
								},
							},
						},
						Export: "file",
					},
				},
			},
		},
	)
	return policyTree
}

func mixedEndpointPolicyTree() *urltree.EndpointTree[config.EndpointPolicy] {
	policyTree, _ := config.BuildEndpointPolicyTree(
		[]sharedConfig.EndpointConfig{
			{
				Method: "GET",
				URL:    "twitter.com/user/1234/messages",
				Diagnosis: []sharedConfig.Diagnosis{
					{
						Name:    "diagnosis1",
						Enabled: true,
						Config: sharedConfig.DiagnosisConfig{
							HARExporter: &sharedConfig.HARExporterConfig{
								TransactionMaxSize: 1000,
								Obfuscate: sharedConfig.Obfuscate{
									Enabled: false,
								},
							},
						},
						Export: "file",
					},
				},
			},
			{
				Method: "GET",
				URL:    "twitter.com/user/1234/posts",
				Remedies: []sharedConfig.Remedy{
					{
						Name:    "remedy1",
						Enabled: true,
						Config: sharedConfig.RemedyConfig{
							FixedResponse: &sharedConfig.FixedResponseConfig{
								StatusCode: 418,
							},
						},
					},
				},
				Diagnosis: []sharedConfig.Diagnosis{
					{
						Name:    "diagnosis1",
						Enabled: true,
						Config: sharedConfig.DiagnosisConfig{
							HARExporter: &sharedConfig.HARExporterConfig{
								TransactionMaxSize: 1000,
								Obfuscate: sharedConfig.Obfuscate{
									Enabled: false,
								},
							},
						},
						Export: "file",
					},
				},
			},
		},
	)
	return policyTree
}

type mockWriter struct {
	messages string
}

func (writer *mockWriter) Write(b []byte) (int, error) {
	writer.messages += "\n" + string(b)
	return len(string(b)), nil
}

func (writer *mockWriter) Close() error {
	return nil
}

func newMockWriter() *mockWriter {
	return &mockWriter{}
}
