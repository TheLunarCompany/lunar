package remedies

import (
	"lunar/engine/actions"
	lunarMessages "lunar/engine/messages"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"

	"github.com/rs/zerolog/log"
)

type FixedResponsePlugin struct {
	counter int
	clock   clock.Clock
}

func NewFixedResponsePlugin(clock clock.Clock) *FixedResponsePlugin {
	return &FixedResponsePlugin{
		counter: 0,
		clock:   clock,
	}
}

func (plugin *FixedResponsePlugin) OnRequest(
	onRequest lunarMessages.OnRequest,
	remedyConfig *sharedConfig.FixedResponseConfig,
) (actions.ReqLunarAction, error) {
	var lunarAction actions.ReqLunarAction = &actions.NoOpAction{}
	plugin.counter++
	log.Trace().Msgf("Counter: %v", plugin.counter)

	if onRequest.Headers["early-response"] == "true" {
		body := "{\"message\": \"GO Lunar\"}"
		headers := map[string]string{"powered-by": "Lunar Interventions Inc."}
		lunarAction = &actions.EarlyResponseAction{
			Status:  remedyConfig.StatusCode,
			Body:    body,
			Headers: headers,
		}

	}

	return lunarAction, nil
}

func (plugin *FixedResponsePlugin) OnResponse(
	onResponse lunarMessages.OnResponse,
	_ *sharedConfig.FixedResponseConfig,
) (actions.RespLunarAction, error) {
	log.Trace().Msgf("OnResponse: %+v", onResponse)
	return &actions.NoOpAction{}, nil
}
