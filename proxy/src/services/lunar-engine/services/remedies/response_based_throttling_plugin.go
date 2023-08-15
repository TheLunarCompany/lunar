package remedies

import (
	"errors"
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/messages"
	"lunar/engine/utils"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"strconv"
	"time"

	"github.com/rs/zerolog/log"
	"golang.org/x/exp/slices"
)

type CacheKey struct {
	Method string
	URL    string
}

type CachedResponse struct {
	ID           string
	Body         string
	Headers      map[string]string
	Status       int
	CreationTime time.Time
}

type ResponseBasedThrottlingPlugin struct {
	responseCache utils.Cache[CacheKey, CachedResponse]
	clock         clock.Clock
}

func NewResponseBasedThrottlingPlugin(
	clock clock.Clock,
) *ResponseBasedThrottlingPlugin {
	return &ResponseBasedThrottlingPlugin{
		responseCache: utils.NewMemoryCache[CacheKey, CachedResponse](clock),
		clock:         clock,
	}
}

func (plugin *ResponseBasedThrottlingPlugin) OnRequest(
	onRequest messages.OnRequest,
	remedyConfig *sharedConfig.ResponseBasedThrottlingConfig,
) (actions.ReqLunarAction, error) {
	log.Debug().Msgf("All throttled responses: %+v", plugin.responseCache)

	cacheKey := CacheKey{onRequest.Method, onRequest.URL}

	cachedResponse, found := plugin.responseCache.Get(cacheKey)
	if !found {
		return &actions.NoOpAction{}, nil
	}
	headers, err := getUpdatedHeaders(
		remedyConfig,
		cachedResponse,
		plugin.clock,
	)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to get updated headers," +
			" not serving throttled response")
		return &actions.NoOpAction{}, nil
	}

	log.Debug().Msgf(
		"📦 Serving throttled response with status code %v",
		cachedResponse.Status,
	)
	log.Debug().Msgf("With headers %+v", headers)

	lunarAction := &actions.EarlyResponseAction{
		Status:  cachedResponse.Status,
		Body:    cachedResponse.Body,
		Headers: headers,
	}

	return lunarAction, nil
}

func (plugin *ResponseBasedThrottlingPlugin) OnResponse(
	onResponse messages.OnResponse,
	remedyConfig *sharedConfig.ResponseBasedThrottlingConfig,
) (actions.RespLunarAction, error) {
	if !slices.Contains(remedyConfig.RelevantStatuses, onResponse.Status) {
		log.Debug().
			Msgf("Response with status code %v, continue", onResponse.Status)
		return &actions.NoOpAction{}, nil
	}

	cacheKey := CacheKey{onResponse.Method, onResponse.URL}
	if plugin.responseCache.Has(cacheKey) {
		return &actions.NoOpAction{}, nil // already cached
	}

	cachedResponse := CachedResponse{
		ID:           onResponse.ID,
		Body:         onResponse.Body,
		Headers:      onResponse.Headers,
		Status:       onResponse.Status,
		CreationTime: plugin.clock.Now(),
	}

	retryAfterSeconds, err := readRetryAfter(
		onResponse.Headers, remedyConfig, plugin.clock)
	if err != nil {
		log.Warn().
			Msgf("Failed to read Retry-After header, not saving response [%v]", err)
		return &actions.NoOpAction{}, nil
	}

	log.Info().Msgf(
		"✍️  Saving throttled response with status code %v for %v seconds",
		onResponse.Status,
		retryAfterSeconds,
	)
	plugin.responseCache.Set(cacheKey, cachedResponse, retryAfterSeconds)

	return &actions.NoOpAction{}, nil
}

func readRetryAfter(
	headers map[string]string,
	remedyConfig *sharedConfig.ResponseBasedThrottlingConfig,
	clock clock.Clock,
) (float64, error) {
	retryAfterVal, found := headers[remedyConfig.RetryAfterHeader]
	if !found {
		return 0, fmt.Errorf("Retry-After header not found in response")
	}

	retryAfterSeconds, err := normalizeRetryAfter(
		retryAfterVal, remedyConfig.RetryAfterType, clock,
	)
	if err != nil {
		return 0, err
	}
	return retryAfterSeconds, nil
}

func normalizeRetryAfter(
	retryAfterVal string,
	retryAfterType sharedConfig.RetryAfterType,
	clock clock.Clock,
) (float64, error) {
	retryAfterNum, err := strconv.ParseFloat(retryAfterVal, 64)
	if err != nil {
		return 0, errors.Join(
			fmt.Errorf("Failed to parse Retry-After value: %v", retryAfterVal),
			err,
		)
	}

	switch retryAfterType {

	case sharedConfig.RetryAfterAbsoluteEpoch:
		now := clock.Now().Unix()
		return retryAfterNum - float64(now), nil

	case sharedConfig.RetryAfterRelativeSeconds:
		return retryAfterNum, nil

	case sharedConfig.RetryAfterUndefined:
		return 0, fmt.Errorf("Invalid Retry-After type: %v", retryAfterType)
	default:
		return 0, fmt.Errorf("Invalid Retry-After type: %v", retryAfterType)
	}
}

func getUpdatedHeaders(
	remedyConfig *sharedConfig.ResponseBasedThrottlingConfig,
	cachedResponse CachedResponse,
	clock clock.Clock,
) (map[string]string, error) {
	if remedyConfig.RetryAfterType != sharedConfig.RetryAfterRelativeSeconds {
		return cachedResponse.Headers, nil
	}

	retryAfter, err := readRetryAfter(
		cachedResponse.Headers,
		remedyConfig,
		clock,
	)
	if err != nil {
		joinedErr := errors.Join(fmt.Errorf(
			"Failed to read Retry-After header for transaction ID [%v],"+
				" serving unmodified response",
			cachedResponse.ID,
		), err)
		return nil, joinedErr
	}

	lapsedTime := clock.Now().Sub(cachedResponse.CreationTime)
	updatedRetryAfter, err := calcNewRetryAfter(retryAfter, lapsedTime)
	if err != nil {
		joinedErr := errors.Join(fmt.Errorf(
			"Failed to calculate new Retry-After value for transaction ID [%v],"+
				" serving unmodified response",
			cachedResponse.ID,
		), err)
		return nil, joinedErr
	}

	headers := map[string]string{}
	for k, v := range cachedResponse.Headers {
		if k == remedyConfig.RetryAfterHeader {
			headers[k] = updatedRetryAfter
			continue
		}
		headers[k] = v
	}

	log.Debug().Msgf("Updating Retry-After header for transaction ID [%v]."+
		" Original: '%v' Updated: '%v'",
		cachedResponse.ID, retryAfter, updatedRetryAfter)

	return headers, nil
}

func calcNewRetryAfter(
	retryAfterSeconds float64,
	lapsedTime time.Duration,
) (string, error) {
	lapsedSeconds := float64(lapsedTime.Seconds())
	if lapsedSeconds >= retryAfterSeconds {
		return "", fmt.Errorf("Failed to calculate new Retry-After value," +
			" Retry-After time has already passed, serving unmodified response")
	}
	updatedRetryAfter := retryAfterSeconds - lapsedSeconds
	updatedRetryAfterStr := fmt.Sprintf("%v", updatedRetryAfter)
	return updatedRetryAfterStr, nil
}
