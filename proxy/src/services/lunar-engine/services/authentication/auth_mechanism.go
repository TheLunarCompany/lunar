package authentication

import (
	"lunar/engine/actions"
	"lunar/engine/config"
	"lunar/engine/messages"
	sharedConfig "lunar/shared-model/config"

	"github.com/rs/zerolog/log"
)

type AuthMechanism struct {
	basic  *BasicAuth
	apiKey *APIKeyAuth
	oauth  *OAuth
}

func NewAuthMechanism() *AuthMechanism {
	return &AuthMechanism{NewBasicAuth(), NewAPIKeyAuth(), NewOAuth()}
}

func (auth AuthMechanism) GetMechanism(
	authType sharedConfig.AuthType,
) func(messages.OnRequest, config.Endpoint,
	sharedConfig.Authentication) (actions.ReqLunarAction, error) {
	var result func(messages.OnRequest, config.Endpoint,
		sharedConfig.Authentication) (actions.ReqLunarAction, error)
	switch authType {
	case sharedConfig.AuthBasic:
		result = auth.basic.OnRequest
	case sharedConfig.AuthAPI:
		result = auth.apiKey.OnRequest
	case sharedConfig.AuthOAuth:
		result = auth.oauth.OnRequest
	case sharedConfig.AuthUndefined:
		result = onError
	}

	return result
}

func onError(
	_ messages.OnRequest,
	_ config.Endpoint,
	config sharedConfig.Authentication,
) (actions.ReqLunarAction, error) {
	config.Type()
	log.Error().Msg("Authentication undefined, please validate your `policies.yaml`")
	return &actions.NoOpAction{}, nil
}
