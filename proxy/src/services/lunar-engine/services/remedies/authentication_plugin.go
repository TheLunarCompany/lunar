package remedies

import (
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/config"
	"lunar/engine/messages"
	"lunar/engine/services/authentication"
	sharedConfig "lunar/shared-model/config"

	"github.com/rs/zerolog/log"
)

type AuthPlugin struct {
	auth *authentication.AuthMechanism
}

func NewAuthPlugin() *AuthPlugin {
	return &AuthPlugin{authentication.NewAuthMechanism()}
}

func (plugin *AuthPlugin) OnRequest(
	onRequest messages.OnRequest,
	scopedRemedy config.ScopedRemedy,
	accounts map[sharedConfig.AccountID]sharedConfig.Account,
) (actions.ReqLunarAction, error) {
	endpoint := config.Endpoint{
		Method: onRequest.Method,
		URL:    scopedRemedy.NormalizedURL,
	}

	log.Debug().Msgf("Starting authentication process for: %s - %s",
		endpoint.Method, endpoint.URL)
	accountID := scopedRemedy.Remedy.Config.Authentication.Account

	account, found := accounts[accountID]
	if !found {
		err := fmt.Errorf("Account [%v] is not defined in the accounts section",
			accountID)
		return &actions.NoOpAction{}, err
	}

	return plugin.auth.GetMechanism(
		account.Authentication.Type())(onRequest, endpoint, account.Authentication)
}

func (plugin *AuthPlugin) OnResponse() (actions.RespLunarAction, error) {
	return &actions.NoOpAction{}, nil
}
