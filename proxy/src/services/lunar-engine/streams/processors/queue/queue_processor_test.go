package processorqueue_test

import (
	lunarMessages "lunar/engine/messages"
	streamconfig "lunar/engine/streams/config"
	queueProcessor "lunar/engine/streams/processors/queue"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/streams/resources"
	quotaresource "lunar/engine/streams/resources/quota"
	streamtypes "lunar/engine/streams/types"
	contextmanager "lunar/toolkit-core/context-manager"
	"math/rand"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

const (
	allowedKey = "allowed"
	blockedKey = "blocked"
)

func getProcIO(name string) streamtypes.ProcessorIO {
	return streamtypes.ProcessorIO{
		Type: publictypes.StreamTypeAny,
		Name: name,
	}
}

func getParamValue(key string, value interface{}) *publictypes.ParamValue {
	keyValue := &publictypes.KeyValue{
		Key:   key,
		Value: value,
	}
	return keyValue.GetParamValue()
}

func getQuotaData(strategy *quotaresource.StrategyConfig, quotaID string) []*quotaresource.QuotaResourceData {
	return []*quotaresource.QuotaResourceData{
		{
			Quotas: []*quotaresource.QuotaConfig{
				{
					ID: quotaID,
					Filter: &streamconfig.Filter{
						Name: "test",
						URL:  "api.example.com",
					},
					Strategy: strategy,
				},
			},
		},
	}
}

func getRandomString(length int) string {
	source := rand.NewSource(time.Now().UnixNano())
	random := rand.New(source)
	charset := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, length)
	for i := 0; i < length; i++ {
		result[i] = charset[random.Intn(len(charset))]
	}
	return string(result)
}

func getAPIStream() publictypes.APIStreamI {
	return streamtypes.NewRequestAPIStream(
		lunarMessages.OnRequest{
			ID:         getRandomString(10),
			SequenceID: getRandomString(10),
			URL:        "api.example.com",
		},
	)
}

func TestQueueProcessor_EnqueueIfSlotAvailable(t *testing.T) {
	t.Skip("This test is flaky and needs to be fixed. Its seems that the mock clock is not working as expected.")
	strategy := &quotaresource.StrategyConfig{
		FixedWindow: &quotaresource.FixedWindowConfig{
			QuotaLimit: quotaresource.QuotaLimit{
				Max:          1,
				Interval:     10,
				IntervalUnit: "second",
			},
		},
	}
	quotaID := "test"
	resources, _ := resources.NewResourceManagement()
	resources, _ = resources.WithQuotaData(getQuotaData(strategy, quotaID))

	metaData := &streamtypes.ProcessorMetaData{
		Name:                "test",
		Clock:               contextmanager.Get().SetMockClock().GetClock(),
		ProcessorDefinition: streamtypes.ProcessorDefinition{},
		Parameters: map[string]streamtypes.ProcessorParam{
			"quota_id": {
				Name:  quotaID,
				Value: getParamValue("quota_id", quotaID),
			},
			"queue_size": {
				Name:  "queue_size",
				Value: getParamValue("queue_size", 10),
			},
			"ttl_seconds": {
				Name:  "ttl_seconds",
				Value: getParamValue("ttl_seconds", 10),
			},
			"priority_group_by_header": {
				Name:  "priority_group_by_header",
				Value: getParamValue("priority_group_by_header", nil),
			},
			"priority_groups": {
				Name:  "priority_groups",
				Value: getParamValue("priority_groups", nil),
			},
		},
		Resources: resources,
	}
	queueProcessor, err := queueProcessor.NewProcessor(metaData)
	assert.NoError(t, err)
	procIO, err := queueProcessor.Execute("", getAPIStream())
	assert.NoError(t, err)
	assert.NotNil(t, procIO)
	assert.Equal(t, getProcIO(allowedKey), procIO)
}

func TestQueueProcessor_SkipEnqueueIfSlotNotAvailable(t *testing.T) {
	t.Skip("This test is flaky and needs to be fixed. CORE-1266")

	clk := contextmanager.Get().SetMockClock().GetMockClock()
	numberOfTestRequests := 3
	strategy := &quotaresource.StrategyConfig{
		FixedWindow: &quotaresource.FixedWindowConfig{
			QuotaLimit: quotaresource.QuotaLimit{
				Max:          1,
				Interval:     10,
				IntervalUnit: "second",
			},
		},
	}
	quotaID := "test2"
	resources, _ := resources.NewResourceManagement()
	resources, _ = resources.WithQuotaData(getQuotaData(strategy, quotaID))
	metaData := &streamtypes.ProcessorMetaData{
		Name:                quotaID,
		Clock:               clk,
		ProcessorDefinition: streamtypes.ProcessorDefinition{},
		Parameters: map[string]streamtypes.ProcessorParam{
			"quota_id": {
				Name:  "quota_id",
				Value: getParamValue("quota_id", quotaID),
			},
			"queue_size": {
				Name:  "queue_size",
				Value: getParamValue("queue_size", 1),
			},
			"ttl_seconds": {
				Name:  "ttl_seconds",
				Value: getParamValue("ttl_seconds", 10),
			},
			"priority_group_by_header": {
				Name:  "priority_group_by_header",
				Value: getParamValue("priority_group_by_header", nil),
			},
			"priority_groups": {
				Name:  "priority_groups",
				Value: getParamValue("priority_groups", nil),
			},
		},
		Resources: resources,
	}
	queueProcessor, err := queueProcessor.NewProcessor(metaData)
	assert.NoError(t, err)

	resultChan := make(chan result, numberOfTestRequests)
	defer close(resultChan)
	APIStreams := make([]publictypes.APIStreamI, numberOfTestRequests)

	// generate APIStreams for testing
	for i := 0; i < numberOfTestRequests; i++ {
		APIStreams[i] = getAPIStream()
	}

	// Execute the APIStreams
	for i := 0; i < numberOfTestRequests; i++ {
		go execute(APIStreams[i], queueProcessor, resultChan)
	}

	// Wait for all results to be processed
	results := make([]result, numberOfTestRequests)
	for i := 0; i < 3; i++ {
		if i == 2 {
			// Advance time to allow the second request to be dequeued
			clk.AdvanceTime(10 * time.Second)
		}
		results[i] = <-resultChan
	}

	resultPrediction := map[string]int{
		allowedKey: 1, // Expected to be allowed
		blockedKey: 2, // Expected to be blocked
	}

	for _, res := range results {
		assert.NotNil(t, res.procIO)
		resultPrediction[res.procIO.Name]--
	}

	for predictionType, count := range resultPrediction {
		assert.Equal(t, 0, count, "Unexpected result count for prediction: %s", predictionType)
	}
}

type result struct {
	procIO    streamtypes.ProcessorIO
	err       error
	RequestID string
}

func execute(
	APIStream publictypes.APIStreamI,
	processor streamtypes.Processor,
	resultChan chan result,
) {
	procIO, err := processor.Execute("", APIStream)
	resultChan <- result{procIO, err, APIStream.GetID()}
}
