package authentication

import (
	"encoding/base64"
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/config"
	"lunar/engine/messages"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/concurrentmap"

	"github.com/rs/zerolog/log"
)

const (
	AuthHeaderKey = "Authorization"
)

type AuthKey struct {
	EncodedValue string
}

type BasicAuth struct {
	authKeys *concurrentmap.ConcurrentMap[
		config.Endpoint, AuthKey]
}

func NewBasicAuth() *BasicAuth {
	concurrentmap := concurrentmap.NewConcurrentMap[config.Endpoint, AuthKey]()
	return &BasicAuth{&concurrentmap}
}

func (plugin *BasicAuth) OnRequest(
	_ messages.OnRequest,
	endpoint config.Endpoint,
	auth sharedConfig.Authentication,
) (actions.ReqLunarAction, error) {
	log.Debug().Msg("Authenticating using: BasicAuth")
	authValue, found := plugin.authKeys.Lookup(endpoint)

	if !found {
		log.Debug().Msg("Auth value not found, generating new object")
		val := fmt.Sprintf("Basic %s",
			encodeUserAndPassword(auth.Basic.Username, auth.Basic.Password))
		authValue = plugin.authKeys.LookupOrAssign(endpoint, AuthKey{val})
	}

	action := actions.ModifyRequestAction{
		HeadersToSet: map[string]string{
			AuthHeaderKey: authValue.EncodedValue,
		},
	}

	return &action, nil
}

func encodeUserAndPassword(username, password string) string {
	return base64.StdEncoding.EncodeToString(
		[]byte(fmt.Sprintf("%s:%s", username, password)))
}
