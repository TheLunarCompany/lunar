package remedies_test

import (
	"bytes"
	"lunar/engine/actions"
	"lunar/engine/services/remedies"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/clock"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCachePluginOnRequestWithNoCachedResponseReturnNoOpAction(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewCachingPlugin(clock)
	remedyConfig := basicCachingRemedyConfig()
	onRequestArgs := onRequestArgs()

	action, err := plugin.OnRequest(
		onRequestArgs, &remedyConfig, map[string]string{"userID": "999"})
	assert.Nil(t, err)

	assert.Equal(t, &actions.NoOpAction{}, action)
}

func TestCachingPluginOnRequestWithCachedResponseReturnEarlyResponseAction(
	t *testing.T,
) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewCachingPlugin(clock)
	remedyConfig := basicCachingRemedyConfig()
	onRequestArgs := onRequestArgs()
	onResponseArgs := responseArgs(map[string]string{"Retry-After": "1"})

	respAction, onResponseErr := plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
		map[string]string{"userID": "999"},
	)

	assert.Nil(t, onResponseErr)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	action, onRequestErr := plugin.OnRequest(onRequestArgs, &remedyConfig,
		map[string]string{"userID": "999"})
	assert.Nil(t, onRequestErr)

	assert.Equal(t, &actions.EarlyResponseAction{
		Status:  onResponseArgs.Status,
		Body:    onResponseArgs.Body,
		Headers: onResponseArgs.Headers,
	}, action)
}

func TestCachingResponseWithIrrelevantUserIDIsNotCached(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewCachingPlugin(clock)
	remedyConfig := basicCachingRemedyConfig()
	onResponseArgs := basicResponseArgs(404, "999",
		map[string]string{"Retry-After": "1"})
	onRequestArgs := onRequestArgs()

	respAction, onResponseErr := plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
		map[string]string{"userID": "999"},
	)
	assert.Nil(t, onResponseErr)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	onResponseArgs.Body = "123"
	respAction, onResponseErr = plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
		map[string]string{"userID": "123"},
	)
	assert.Nil(t, onResponseErr)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	action, onRequestErr := plugin.OnRequest(onRequestArgs, &remedyConfig,
		map[string]string{"userID": "123"})
	assert.Nil(t, onRequestErr)
	assert.Equal(t, &actions.EarlyResponseAction{
		Status:  onResponseArgs.Status,
		Body:    "123",
		Headers: onResponseArgs.Headers,
	}, action)

	action, onRequestErr = plugin.OnRequest(onRequestArgs, &remedyConfig,
		map[string]string{"userID": "999"})

	assert.Nil(t, onRequestErr)
	assert.Equal(t, &actions.EarlyResponseAction{
		Status:  onResponseArgs.Status,
		Body:    "999",
		Headers: onResponseArgs.Headers,
	}, action)
}

func TestCacheResponseAfterTTLPassed(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewCachingPlugin(clock)
	remedyConfig := cachingRemedyConfig(float32(5), 1000, 1000)

	onResponseArgs := basicResponseArgs(200, "999", map[string]string{})
	onRequestArgs := onRequestArgs()

	respAction, onResponseErr := plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
		map[string]string{"userID": "999"},
	)
	assert.Nil(t, onResponseErr)
	assert.Equal(t, &actions.NoOpAction{}, respAction)
	clock.AdvanceTime(10 * time.Second)

	action, onRequestErr := plugin.OnRequest(onRequestArgs, &remedyConfig,
		map[string]string{"userID": "999"})
	assert.Nil(t, onRequestErr)
	assert.Equal(t, &actions.NoOpAction{}, action)

	respAction, onResponseErr = plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
		map[string]string{"userID": "999"},
	)

	assert.Nil(t, onResponseErr)
	assert.Equal(t, &actions.NoOpAction{}, respAction)
}

func TestNotCachingResponsesWhichExceedMaxRecordSize(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewCachingPlugin(clock)
	remedyConfig := cachingRemedyConfig(float32(5), 1, 1000)

	onResponseArgs := basicResponseArgs(200, "success", map[string]string{})
	onRequestArgs := onRequestArgs()

	respAction, onResponseErr := plugin.OnResponse(
		onResponseArgs,
		&remedyConfig,
		map[string]string{"userID": "999"},
	)
	assert.Nil(t, onResponseErr)
	assert.Equal(t, &actions.NoOpAction{}, respAction)

	action, onRequestErr := plugin.OnRequest(onRequestArgs, &remedyConfig,
		map[string]string{"userID": "999"})
	assert.Nil(t, onRequestErr)

	assert.Equal(t, &actions.NoOpAction{}, action)
}

func TestCacheResponseCacheFull(t *testing.T) {
	t.Parallel()
	clock := clock.NewMockClock()
	plugin := remedies.NewCachingPlugin(clock)
	remedyConfig := cachingRemedyConfig(float32(5), 10240, 0.1)

	onResponseArgs := basicResponseArgs(200, generateBody(10240),
		map[string]string{})
	onRequestArgs := onRequestArgs()

	for i := 0; i < 20; i++ {

		respAction, onResponseErr := plugin.OnResponse(
			onResponseArgs,
			&remedyConfig,
			map[string]string{"userID": strconv.Itoa(i)},
		)

		assert.Nil(t, onResponseErr)
		assert.Equal(t, &actions.NoOpAction{}, respAction)
	}

	action, onRequestErr := plugin.OnRequest(onRequestArgs, &remedyConfig,
		map[string]string{"userID": "999"})
	assert.Nil(t, onRequestErr)

	assert.Equal(t, &actions.NoOpAction{}, action)
}

func generateBody(sizeB int) string {
	var buffer bytes.Buffer

	sizeBytes := sizeB // 1 MB in bytes

	for i := 0; i < sizeBytes; i++ {
		buffer.WriteString("a")
	}

	text := buffer.String()

	return text
}

func cachingRemedyConfig(ttl float32,
	maxRecordSizeBytes int,
	maxCacheSizeMegabytes float32,
) sharedConfig.CachingConfig {
	return sharedConfig.CachingConfig{
		RequestPayloadPaths: []sharedConfig.PayloadPath{
			{
				PayloadType: sharedConfig.PayloadRequestPathParams.String(),
				Path:        "userID",
			},
		},
		TTLSeconds:            ttl,
		MaxRecordSizeBytes:    maxRecordSizeBytes,
		MaxCacheSizeMegabytes: maxCacheSizeMegabytes,
	}
}

func basicCachingRemedyConfig() sharedConfig.CachingConfig {
	return sharedConfig.CachingConfig{
		RequestPayloadPaths: []sharedConfig.PayloadPath{
			{
				PayloadType: sharedConfig.PayloadRequestPathParams.String(),
				Path:        "userID",
			},
		},
		TTLSeconds:            float32(120),
		MaxRecordSizeBytes:    1000,
		MaxCacheSizeMegabytes: 1000,
	}
}
