package runner_test

import (
	"fmt"
	"lunar/engine/config"
	"lunar/engine/messages"
	"lunar/engine/runner"
	"lunar/engine/services"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

const (
	txnID        = "1234-5678-9012-3456"
	proxyTimeout = 15 * time.Second
)

func TestGivenOnRequestAndAMatchingHARExportDiagnosisHARDataIsWritten(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	onRequest := messages.OnRequest{
		ID:         txnID,
		SequenceID: "1234-5678-9012-3456",
		Method:     "GET",
		Scheme:     "https",
		URL:        "twitter.com/user/1234/messages",
		Path:       "/user/1234/messages",
		Query:      "",
		Headers: map[string]string{
			"Host":           "twitter.com",
			"Early-Response": "true",
		},
		Body: "",
		Time: clock.Now(),
	}
	onResponse := messages.OnResponse{
		ID:         txnID,
		SequenceID: "1234-5678-9012-3456",
		Method:     "GET",
		URL:        "twitter.com/user/1234/messages",
		Status:     200,
		Headers: map[string]string{
			"Accept": "*/*",
		},
		Body: "",
		Time: clock.Now(),
	}
	policyTree := diagnosisEndpointPolicyTree()
	globalPolicies := globalPolicies()
	mockWriter := newMockWriter()
	services, _ := services.InitializeServices(clock, mockWriter, proxyTimeout)

	runner.RunTask(
		runner.DiagnosisTask{onRequest, onResponse},
		policyTree,
		globalPolicies.Diagnosis,
		&services.Diagnosis,
		&services.Exporters,
	)

	messages := mockWriter.messages
	assert.Contains(t, messages, "twitter.com/user/1234/messages")
	fmt.Printf("HAR file content: %s \n", messages)
}

func TestGivenOnRequestAndAMatchingFixedResponseRemedyAndHARExportDiagnosisHARDataIsWritten( //nolint:lll
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	onRequest := messages.OnRequest{
		ID:         txnID,
		SequenceID: "1234-5678-9012-3456",
		Method:     "GET",
		Scheme:     "https",
		URL:        "twitter.com/user/1234/messages",
		Path:       "/user/1234/messages",
		Query:      "",
		Headers: map[string]string{
			"Host":           "twitter.com",
			"Early-Response": "true",
		},
		Body: "",
		Time: clock.Now(),
	}
	onResponse := messages.OnResponse{
		ID:         txnID,
		SequenceID: "1234-5678-9012-3456",
		Method:     "GET",
		URL:        "twitter.com/user/1234/messages",
		Status:     200,
		Headers: map[string]string{
			"Host":           "twitter.com",
			"Early-Response": "true",
		},
		Body: "",
		Time: clock.Now(),
	}
	policyTree := fixedRemedyAndDiagnosisEndpointPolicyTree()
	globalPolicies := globalPolicies()
	policiesAccessor := config.SimplePolicyAccessor{
		PoliciesData: &config.PoliciesData{
			Config: sharedConfig.PoliciesConfig{
				Global: *globalPolicies,
			},
			EndpointPolicyTree: *policyTree,
		},
	}
	mockWriter := newMockWriter()
	services, _ := services.InitializeServices(clock, mockWriter, proxyTimeout)
	diagnosisWorker := runner.NewDiagnosisWorker(clock)

	diagnosisWorker.Run(
		&policiesAccessor,
		&services.Diagnosis,
		&services.Exporters,
	)

	runner.RunTask(
		runner.DiagnosisTask{onRequest, onResponse},
		policyTree,
		globalPolicies.Diagnosis,
		&services.Diagnosis,
		&services.Exporters,
	)

	time.Sleep(250 * time.Millisecond)

	assert.Contains(t, mockWriter.messages, "twitter.com/user/1234/messages")
	fmt.Printf("HAR file content: %s \n", mockWriter.messages)
}

func TestGivenOnMultipleDifferentRequestsAllAreDiagnosed(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	onRequest1 := messages.OnRequest{
		ID:         txnID,
		SequenceID: "1234-5678-9012-3456",
		Method:     "GET",
		Scheme:     "https",
		URL:        "twitter.com/user/1234/messages",
		Path:       "/user/1234/messages",
		Query:      "",
		Headers: map[string]string{
			"Host":           "twitter.com",
			"Early-Response": "true",
		},
		Body: "",
		Time: clock.Now(),
	}
	onResponse1 := messages.OnResponse{
		ID:         txnID,
		SequenceID: "1234-5678-9012-3456",
		Method:     "GET",
		URL:        "twitter.com/user/1234/messages",
		Status:     200,
		Headers: map[string]string{
			"Accept": "*/*",
		},
		Body: "",
		Time: clock.Now(),
	}
	onRequest2 := messages.OnRequest{
		ID:         "5678-9012-3456-7890",
		SequenceID: "3333-5678-9012-3456",
		Method:     "GET",
		Scheme:     "https",
		URL:        "twitter.com/user/1234/posts",
		Path:       "/user/1234/messages",
		Query:      "",
		Headers: map[string]string{
			"Host":           "twitter.com",
			"Early-Response": "true",
		},
		Body: "",
		Time: clock.Now(),
	}
	onResponse2 := messages.OnResponse{
		ID:         "5678-9012-3456-7890",
		SequenceID: "3333-5678-9012-3456",
		Method:     "GET",
		URL:        "twitter.com/user/1234/posts",
		Status:     200,
		Headers: map[string]string{
			"Accept": "*/*",
		},
		Body: "",
		Time: clock.Now(),
	}
	policyTree := mixedEndpointPolicyTree()
	globalPolicies := globalPolicies()
	mockWriter := newMockWriter()
	services, _ := services.InitializeServices(clock, mockWriter, proxyTimeout)

	runner.RunTask(
		runner.DiagnosisTask{onRequest1, onResponse1},
		policyTree,
		globalPolicies.Diagnosis,
		&services.Diagnosis,
		&services.Exporters,
	)
	runner.RunTask(
		runner.DiagnosisTask{onRequest2, onResponse2},
		policyTree,
		globalPolicies.Diagnosis,
		&services.Diagnosis,
		&services.Exporters,
	)

	assert.Contains(t, mockWriter.messages, "twitter.com/user/1234/messages")
	assert.Contains(t, mockWriter.messages, "twitter.com/user/1234/posts")
	fmt.Printf("HAR file content: %s \n", mockWriter.messages)
}
