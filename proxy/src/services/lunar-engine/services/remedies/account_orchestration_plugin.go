package remedies

import (
	"fmt"
	"lunar/engine/actions"
	lunarMessages "lunar/engine/messages"
	sharedConfig "lunar/shared-model/config"
	"sync"

	"github.com/rs/zerolog/log"
)

type AccountOrchestrationPlugin struct {
	accountID int

	mutex *sync.Mutex
}

func NewAccountOrchestrationPlugin() *AccountOrchestrationPlugin {
	return &AccountOrchestrationPlugin{
		accountID: 0,
		mutex:     &sync.Mutex{},
	}
}

func (plugin *AccountOrchestrationPlugin) OnRequest(
	onRequest lunarMessages.OnRequest,
	remedyConfig *sharedConfig.AccountOrchestrationConfig,
	accounts map[sharedConfig.AccountID]sharedConfig.Account,
) (actions.ReqLunarAction, error) {
	var lunarAction actions.ReqLunarAction = &actions.NoOpAction{}
	numAccounts := len(remedyConfig.RoundRobin)
	if numAccounts == 0 {
		err := fmt.Errorf("no accounts configured for orchestration")
		return lunarAction, err
	}

	plugin.mutex.Lock()
	currentAccountID := plugin.accountID % numAccounts
	accountName := remedyConfig.RoundRobin[currentAccountID]
	plugin.accountID = (plugin.accountID + 1) % numAccounts
	plugin.mutex.Unlock()

	account, found := accounts[accountName]
	if !found {
		err := fmt.Errorf("account [%v] is not defined in the accounts section",
			accountName)
		return lunarAction, err
	}
	lunarAction = modifyRequestToUseAccount(onRequest, account, accounts)

	return lunarAction, nil
}

func (plugin *AccountOrchestrationPlugin) OnResponse(
	_ lunarMessages.OnResponse,
	_ *sharedConfig.AccountOrchestrationConfig,
) (actions.RespLunarAction, error) {
	return &actions.NoOpAction{}, nil
}

func modifyRequestToUseAccount(
	onRequestArgs lunarMessages.OnRequest,
	accountToUse sharedConfig.Account,
	accounts map[sharedConfig.AccountID]sharedConfig.Account,
) actions.ReqLunarAction {
	headers := map[string]string{}
	for _, token := range accountToUse.Tokens {
		if value, found := onRequestArgs.Headers[token.Header.Name]; found {
			if value == token.Header.Value {
				continue // Token already present in request
			}

			// Check if the token is from an unknown account
			knownToken := false
			for _, account := range accounts {
				for _, token := range account.Tokens {
					if value == token.Header.Value {
						knownToken = true
					}
				}
			}
			if !knownToken {
				log.Trace().
					Msg("Unknown account token is already present in request")
			}
		}

		headers[token.Header.Name] = token.Header.Value
	}
	if len(headers) == 0 {
		return &actions.NoOpAction{}
	}
	return &actions.ModifyRequestAction{
		HeadersToSet: headers,
	}
}
