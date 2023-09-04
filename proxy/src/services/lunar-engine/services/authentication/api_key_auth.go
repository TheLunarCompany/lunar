package authentication

import (
	"lunar/engine/actions"
	"lunar/engine/config"
	"lunar/engine/messages"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/concurrentmap"

	"github.com/rs/zerolog/log"
)

type APIKeyAuth struct {
	headers *concurrentmap.ConcurrentMap[
		config.Endpoint, map[string]string]
}

func NewAPIKeyAuth() *APIKeyAuth {
	concurrentmap := concurrentmap.NewConcurrentMap[config.Endpoint,
		map[string]string]()
	return &APIKeyAuth{&concurrentmap}
}

func (plugin *APIKeyAuth) OnRequest(
	_ messages.OnRequest,
	endpoint config.Endpoint,
	auth sharedConfig.Authentication,
) (actions.ReqLunarAction, error) {
	log.Debug().Msg("Authenticating using: ApiKeyAuth")
	headers, found := plugin.headers.Lookup(endpoint)

	if !found {
		log.Debug().Msg("Headers not found, generating new object")
		headers = plugin.headers.LookupOrAssign(endpoint,
			generateHeaders(auth.APIKey.Tokens))
	}

	if len(headers) == 0 {
		return &actions.NoOpAction{}, nil
	}

	return &actions.ModifyRequestAction{
		HeadersToSet: headers,
	}, nil
}

func generateHeaders(tokens []sharedConfig.Header) map[string]string {
	headers := map[string]string{}

	for _, token := range tokens {
		headers[token.Name] = token.Value
	}

	return headers
}
