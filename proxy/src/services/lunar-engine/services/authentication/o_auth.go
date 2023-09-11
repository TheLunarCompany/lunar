package authentication

import (
	"lunar/engine/actions"
	"lunar/engine/config"
	"lunar/engine/messages"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/concurrentmap"

	"github.com/goccy/go-json"
	"github.com/rs/zerolog/log"
)

type OAuth struct {
	bodies *concurrentmap.ConcurrentMap[
		config.Endpoint, string]
}

func NewOAuth() *OAuth {
	concurrentmap := concurrentmap.NewConcurrentMap[config.Endpoint, string]()
	return &OAuth{&concurrentmap}
}

func (plugin *OAuth) OnRequest(
	onRequest messages.OnRequest,
	endpoint config.Endpoint,
	auth sharedConfig.Authentication,
) (actions.ReqLunarAction, error) {
	log.Debug().Msg("Authenticating using: OAuth")
	body, found := plugin.bodies.Lookup(endpoint)

	if !found {
		log.Debug().Msg("Body not found, generating new object")

		generatedBody, err := generateBody(onRequest, auth.OAuth.Tokens)
		if err != nil {
			return &actions.NoOpAction{}, err
		}

		marshalledBody, err := json.Marshal(generatedBody)
		if err != nil {
			return &actions.NoOpAction{}, err
		}

		body = plugin.bodies.LookupOrAssign(endpoint, string(marshalledBody))
	}

	if len(body) == 0 {
		return &actions.NoOpAction{}, nil
	}

	return &actions.GenerateRequestAction{
		Body:            body,
		HeadersToSet:    onRequest.Headers,
		HeadersToRemove: []string{"content-length"},
	}, nil
}

func generateBody(onRequest messages.OnRequest,
	tokens []sharedConfig.Body,
) (map[string]interface{}, error) {
	var body map[string]interface{}
	rawBody := onRequest.Body

	if rawBody == "" {
		rawBody = "{}"
	}

	err := json.Unmarshal([]byte(rawBody), &body)
	if err != nil {
		return body, err
	}

	for _, token := range tokens {
		body[token.Name] = token.Value
	}

	return body, nil
}
