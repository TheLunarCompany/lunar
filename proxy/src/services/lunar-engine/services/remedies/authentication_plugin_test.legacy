package remedies_test

import (
	"lunar/engine/actions"
	"lunar/engine/config"
	lunarMessages "lunar/engine/messages"
	"lunar/engine/services/remedies"
	"lunar/engine/utils"
	sharedConfig "lunar/shared-model/config"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestBasicAuth(
	t *testing.T,
) {
	t.Parallel()
	// "BasicName:BasicValue" -Base64=> "QmFzaWNOYW1lOkJhc2ljVmFsdWU="
	base64Value := "Basic QmFzaWNOYW1lOkJhc2ljVmFsdWU="
	accounts := buildAuthAccount(sharedConfig.AuthBasic)
	plugin := remedies.NewAuthPlugin()
	config := buildAuthRemedy()

	onRequest := buildAuthOnRequest("a", "a")
	action, err := plugin.OnRequest(onRequest, config, accounts)

	assert.Nil(t, err)

	wantAction := actions.ModifyRequestAction{
		HeadersToSet: map[string]string{"Authorization": base64Value},
	}

	assert.Equal(t, &wantAction, action)
}

func TestOAuth(
	t *testing.T,
) {
	t.Parallel()
	excpectedBody := "{\"OAuthName\":\"OAuthValue\",\"OAuthName1\":\"OAuthValue1\",\"OAuthName2\":\"OAuthValue2\"}"
	accounts := buildAuthAccount(sharedConfig.AuthOAuth)
	plugin := remedies.NewAuthPlugin()
	config := buildAuthRemedy()

	onRequest := buildAuthOnRequest("a", "a")
	println(onRequest.Body)
	action, err := plugin.OnRequest(onRequest, config, accounts)
	assert.Nil(t, err)

	wantAction := actions.GenerateRequestAction{
		HeadersToSet:    onRequest.Headers,
		HeadersToRemove: []string{"content-length"},
		Body:            excpectedBody,
	}
	assert.Equal(t, &wantAction, action)
}

func TestAPIKeyAuth(t *testing.T) {
	t.Parallel()
	accounts := buildAuthAccount(sharedConfig.AuthAPI)
	plugin := remedies.NewAuthPlugin()
	config := buildAuthRemedy()

	onRequest := buildAuthOnRequest("a", "a")
	action, err := plugin.OnRequest(onRequest, config, accounts)
	assert.Nil(t, err)

	wantAction := actions.ModifyRequestAction{
		HeadersToSet: map[string]string{
			"APIKeyName":  "APIKeyValue",
			"APIKeyName1": "APIKeyValue1",
		},
	}
	assert.Equal(t, &wantAction, action)
}

func buildAuthAccount(
	authType sharedConfig.AuthType,
) map[sharedConfig.AccountID]sharedConfig.Account {
	accounts := map[sharedConfig.AccountID]sharedConfig.Account{}
	var headerTokens []sharedConfig.Header
	var bodyTokens []sharedConfig.Body

	headerTokens = append(headerTokens,
		sharedConfig.Header{Name: "APIKeyName", Value: "APIKeyValue"})
	headerTokens = append(headerTokens,
		sharedConfig.Header{Name: "APIKeyName1", Value: "APIKeyValue1"})

	bodyTokens = append(bodyTokens,
		sharedConfig.Body{Name: "OAuthName", Value: "OAuthValue"})
	bodyTokens = append(bodyTokens,
		sharedConfig.Body{Name: "OAuthName1", Value: "OAuthValue1"})
	bodyTokens = append(bodyTokens,
		sharedConfig.Body{Name: "OAuthName2", Value: "OAuthValue2"})

	auth := sharedConfig.Authentication{
		Basic: &sharedConfig.BasicAuth{
			Username: "BasicName",
			Password: "BasicValue",
		},
		APIKey:   &sharedConfig.APIKey{Tokens: headerTokens},
		OAuth:    &sharedConfig.OAuth{Tokens: bodyTokens},
		AuthType: authType,
	}

	accounts["test"] = sharedConfig.Account{Authentication: auth}
	return accounts
}

func buildAuthOnRequest(
	id string,
	sequenceID string,
) lunarMessages.OnRequest {
	onRequest := basicRequestArgs(map[string]string{}, "{}")
	onRequest.ID = id
	onRequest.SequenceID = sequenceID
	return onRequest
}

func buildAuthRemedy() config.ScopedRemedy {
	remedyConfig := sharedConfig.AuthConfig{Account: "test"}
	remedy := sharedConfig.Remedy{
		Enabled: true,
		Name:    "test",
		Config: sharedConfig.RemedyConfig{
			Authentication: &remedyConfig,
		},
	}
	return config.ScopedRemedy{
		Scope:         utils.ScopeEndpoint,
		Method:        "GET",
		NormalizedURL: "twitter.com/user/login",
		Remedy:        &remedy,
	}
}
