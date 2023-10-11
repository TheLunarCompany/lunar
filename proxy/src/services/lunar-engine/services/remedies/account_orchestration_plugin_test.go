package remedies_test

import (
	"lunar/engine/actions"
	"lunar/engine/services/remedies"
	sharedConfig "lunar/shared-model/config"
	"testing"

	"github.com/stretchr/testify/assert"
)

const (
	account1 = "account1"
	account2 = "account2"
)

func TestAccountOrchestrationPluginShouldSwitchBetweenAccountsWhenRemedyIsEnabled( //nolint:lll
	t *testing.T,
) {
	t.Parallel()

	plugin := remedies.NewAccountOrchestrationPlugin()
	config := accountOrchestrationRemedyConfig()
	onRequestArgs := onRequestArgs()
	accounts := accounts()

	lunarActions := []actions.ReqLunarAction{}
	for i := 0; i < 4; i++ {
		lunarAction, err := plugin.OnRequest(onRequestArgs, config, accounts)
		assert.Nil(t, err)
		lunarActions = append(lunarActions, lunarAction)
	}

	wantKeys := []string{
		accounts[account1].Tokens[0].Header.Name,
		accounts[account2].Tokens[0].Header.Name,
		accounts[account1].Tokens[0].Header.Name,
		accounts[account2].Tokens[0].Header.Name,
	}
	wantValues := []string{
		accounts[account1].Tokens[0].Header.Value,
		accounts[account2].Tokens[0].Header.Value,
		accounts[account1].Tokens[0].Header.Value,
		accounts[account2].Tokens[0].Header.Value,
	}

	for i, lunarAction := range lunarActions {
		assert.Equal(t, &actions.ModifyRequestAction{
			HeadersToSet: map[string]string{
				wantKeys[i]: wantValues[i],
			},
		}, lunarAction)
	}
}

func TestAccountOrchestrationPluginShouldReturnErrorWhenAccountIsNotDefined(
	t *testing.T,
) {
	t.Parallel()

	plugin := remedies.NewAccountOrchestrationPlugin()
	remedyConfig := accountOrchestrationRemedyConfig()
	onRequestArgs := onRequestArgs()
	accounts := accounts()

	remedyConfig.RoundRobin = []sharedConfig.AccountID{"not-defined"}

	lunarAction, err := plugin.OnRequest(onRequestArgs, remedyConfig, accounts)
	assert.Equal(t, &actions.NoOpAction{}, lunarAction)
	assert.EqualError(t,
		err, "Account [not-defined] is not defined in the accounts section")
}

func TestAccountOrchestrationPluginShouldReturnErrorWhenNoAccountsAreDefined(
	t *testing.T,
) {
	t.Parallel()

	plugin := remedies.NewAccountOrchestrationPlugin()
	remedyConfig := accountOrchestrationRemedyConfig()
	onRequestArgs := onRequestArgs()
	accounts := accounts()

	remedyConfig.RoundRobin = []sharedConfig.AccountID{}

	lunarAction, err := plugin.OnRequest(onRequestArgs, remedyConfig, accounts)
	assert.Equal(t, &actions.NoOpAction{}, lunarAction)
	assert.EqualError(t, err, "No accounts configured for orchestration")
}

func TestAccountOrchestratorPluginShouldSwitchBetweenAccountsWhenAnUnknownTokenIsAlreadyInTheRequest( //nolint:lll
	t *testing.T,
) {
	t.Parallel()

	plugin := remedies.NewAccountOrchestrationPlugin()
	remedyConfig := accountOrchestrationRemedyConfig()
	onRequestArgs := onRequestArgs()
	accounts := accounts()

	onRequestArgs.Headers = map[string]string{
		"Authorization": "Bearer 3434-343434",
	}

	lunarActions := []actions.ReqLunarAction{}
	for i := 0; i < 2; i++ {
		lunarAction, err := plugin.OnRequest(
			onRequestArgs,
			remedyConfig,
			accounts,
		)
		assert.Nil(t, err)
		lunarActions = append(lunarActions, lunarAction)
	}

	wantKeys := []string{
		accounts[account1].Tokens[0].Header.Name,
		accounts[account2].Tokens[0].Header.Name,
	}
	wantValues := []string{
		accounts[account1].Tokens[0].Header.Value,
		accounts[account2].Tokens[0].Header.Value,
	}

	for i, lunarAction := range lunarActions {
		assert.Equal(t, &actions.ModifyRequestAction{
			HeadersToSet: map[string]string{
				wantKeys[i]: wantValues[i],
			},
		}, lunarAction)
	}
}

func accountOrchestrationRemedyConfig() *sharedConfig.AccountOrchestrationConfig { //nolint:lll
	return &sharedConfig.AccountOrchestrationConfig{
		RoundRobin: []sharedConfig.AccountID{account1, account2},
	}
}

func accounts() map[sharedConfig.AccountID]sharedConfig.Account {
	return map[sharedConfig.AccountID]sharedConfig.Account{
		account1: {
			Tokens: []sharedConfig.Token{
				{
					Header: &sharedConfig.Header{
						Name:  "Authorization",
						Value: "Bearer 123",
					},
				},
			},
		},
		account2: {
			Tokens: []sharedConfig.Token{
				{
					Header: &sharedConfig.Header{
						Name:  "Authorization",
						Value: "Bearer 456",
					},
				},
			},
		},
	}
}
