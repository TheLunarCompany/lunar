package remedies

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"lunar/engine/actions"
	lunarMessages "lunar/engine/messages"
	"lunar/engine/utils"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"strings"

	"github.com/rs/zerolog/log"
)

type CachingPluginKey struct {
	Method               string
	URL                  string
	HashedRequestPayload string
}

type CachingPlugin struct {
	responseCache utils.Cache[CachingPluginKey, CachedResponse]
	clock         clock.Clock
}

func NewCachingPlugin(
	clock clock.Clock,
) *CachingPlugin {
	return &CachingPlugin{
		responseCache: utils.NewMemoryCache[CachingPluginKey,
			CachedResponse](clock),
		clock: clock,
	}
}

func (plugin *CachingPlugin) OnRequest(
	onRequest lunarMessages.OnRequest,
	remedyConfig *sharedConfig.CachingConfig,
	pathParams map[string]string,
) (actions.ReqLunarAction, error) {
	cachingKey := CachingPluginKey{
		onRequest.Method, onRequest.URL,
		extractHashedPathParams(pathParams, remedyConfig.RequestPayloadPaths),
	}

	cachedResponse, found := plugin.responseCache.Get(cachingKey)
	if !found {
		return &actions.NoOpAction{}, nil
	}

	log.Debug().Msgf(
		"📦 Serving cached response with status code %v",
		cachedResponse.Status,
	)

	lunarAction := &actions.EarlyResponseAction{
		Status:  cachedResponse.Status,
		Body:    cachedResponse.Body,
		Headers: cachedResponse.Headers,
	}

	return lunarAction, nil
}

func (plugin *CachingPlugin) OnResponse(
	onResponse lunarMessages.OnResponse,
	remedyConfig *sharedConfig.CachingConfig,
	pathParams map[string]string,
) (actions.RespLunarAction, error) {
	bodySize := len([]byte(onResponse.Body))
	if bodySize > remedyConfig.MaxRecordSizeBytes {
		log.Debug().Msgf("Response too big, received body size: %+v, "+
			"not saving response.", bodySize)
		return &actions.NoOpAction{}, nil
	}

	cachingKey := CachingPluginKey{
		onResponse.Method, onResponse.URL,
		extractHashedPathParams(pathParams, remedyConfig.RequestPayloadPaths),
	}
	if plugin.responseCache.Has(cachingKey) {
		return &actions.NoOpAction{}, nil
	}

	cachedResponse := CachedResponse{
		ID:           onResponse.ID,
		Body:         onResponse.Body,
		Headers:      onResponse.Headers,
		Status:       onResponse.Status,
		CreationTime: plugin.clock.Now(),
	}

	log.Info().Msgf(
		"✍️  Caching response with status code %v for %v seconds",
		onResponse.Status,
		remedyConfig.TTLSeconds,
	)

	plugin.responseCache.WithMaxCacheSize(calculateSize,
		float64(remedyConfig.MaxCacheSizeMegabytes))

	err := plugin.responseCache.Set(cachingKey, cachedResponse,
		float64(remedyConfig.TTLSeconds))
	if err != nil {
		log.Warn().Msgf("Cannot add item: %+v", err)
	}

	return &actions.NoOpAction{}, nil
}

func extractHashedPathParams(pathParams map[string]string,
	payloadPaths []sharedConfig.PayloadPath,
) string {
	values := make([]string, len(payloadPaths))

	for _, key := range payloadPaths {
		if key.PayloadType == sharedConfig.PayloadRequestPathParams.String() {
			if pathParams[key.Path] != "" {
				pathParamValue := fmt.Sprintf("%s:%s", key.Path, pathParams[key.Path])
				values = append(values, pathParamValue)
			}
		}
	}
	// tbd - values > 0
	joined := strings.Join(values, ".")

	// Compute the SHA-256 hash
	hash := sha256.Sum256([]byte(joined))

	// Convert the hash to a hexadecimal string
	hashedString := hex.EncodeToString(hash[:])

	return hashedString
}

func calculateSize(cachingKey CachingPluginKey,
	cachingValue CachedResponse,
) float64 {
	var size int64

	// Calculate size for CachingPluginKey
	size += int64(len(cachingKey.Method))
	size += int64(len(cachingKey.URL))
	size += int64(len(cachingKey.HashedRequestPayload))

	// Calculate size for CachedResponse
	size += int64(len(cachingValue.ID))
	size += int64(len(cachingValue.Body))

	for key, value := range cachingValue.Headers {
		size += int64(len(key) + len(value)) // add the length of strings in the map
	}

	size += int64(4) // for Status field
	size += int64(8) // for CreationTime field

	return float64(size) / 1024 / 1024
}
