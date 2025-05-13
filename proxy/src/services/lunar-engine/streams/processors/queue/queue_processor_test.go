package processorqueue_test

import (
	"context"
	"fmt"
	lunar_messages "lunar/engine/messages"
	stream_config "lunar/engine/streams/config"
	lunar_context "lunar/engine/streams/lunar-context"
	queue_processor "lunar/engine/streams/processors/queue"
	public_types "lunar/engine/streams/public-types"
	"lunar/engine/streams/resources"
	quota_resource "lunar/engine/streams/resources/quota"
	stream_types "lunar/engine/streams/types"
	context_manager "lunar/toolkit-core/context-manager"
	"math/rand"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

var sharedState = lunar_context.NewMemoryState[[]byte]()

const (
	allowedKey = "allowed"
	blockedKey = "blocked"
)

func getProcIO(name string) stream_types.ProcessorIO {
	return stream_types.ProcessorIO{
		Type: public_types.StreamTypeAny,
		Name: name,
	}
}

func getParamValue(key string, value interface{}) *public_types.ParamValue {
	keyValue := &public_types.KeyValue{
		Key:   key,
		Value: value,
	}
	return keyValue.GetParamValue()
}

func getQuotaData(strategy *quota_resource.StrategyConfig, quotaID string) []*quota_resource.QuotaResourceData {
	return []*quota_resource.QuotaResourceData{
		{
			Quotas: []*quota_resource.QuotaConfig{
				{
					ID: quotaID,
					Filter: &stream_config.Filter{
						Name: quotaID,
						URL:  "api.example.com/*",
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

func getAPIStream() public_types.APIStreamI {
	return stream_types.NewRequestAPIStream(
		lunar_messages.OnRequest{
			ID:         getRandomString(20),
			SequenceID: getRandomString(20),
			URL:        "api.example.com/" + getRandomString(5),
		},
		sharedState,
	)
}

func TestQueueProcessor_EnqueueIfSlotAvailable(t *testing.T) {
	memoryState := lunar_context.NewMemoryState[string]()

	strategy := &quota_resource.StrategyConfig{
		FixedWindow: &quota_resource.FixedWindowConfig{
			QuotaLimit: quota_resource.QuotaLimit{
				Max:          1,
				Interval:     10,
				IntervalUnit: "second",
			},
		},
	}
	quotaID := "test"
	resources, _ := resources.NewResourceManagement()
	resources, _ = resources.WithQuotaData(getQuotaData(strategy, quotaID))
	clk := context_manager.Get().SetRealClock().GetClock()
	metaData := &stream_types.ProcessorMetaData{
		Name:                "test",
		SharedMemory:        memoryState.WithClock(clk),
		Clock:               clk,
		ProcessorDefinition: stream_types.ProcessorDefinition{},
		Parameters: map[string]stream_types.ProcessorParam{
			"quota_id": {
				Name:  quotaID,
				Value: getParamValue("quota_id", quotaID),
			},
			"queue_size": {
				Name:  "queue_size",
				Value: getParamValue("queue_size", 10),
			},
			"redis_queue_size": {
				Name:  "redis_queue_size",
				Value: getParamValue("redis_queue_size", -1),
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
			"group_by_header": {
				Name:  "group_by_header",
				Value: getParamValue("group_by_header", "default"),
			},
		},
		Resources: resources,
	}
	queueProcessor, err := queue_processor.NewProcessor(metaData)
	require.NoError(t, err)
	procIO, err := queueProcessor.Execute("", getAPIStream())
	require.NoError(t, err)
	require.NotNil(t, procIO)
	require.Equal(t, getProcIO(allowedKey), procIO)
}

func TestQueueProcessor_SkipEnqueueIfSlotNotAvailable(t *testing.T) {
	var wg sync.WaitGroup

	clk := context_manager.Get().GetClock()
	memoryState := lunar_context.NewSharedState[string]()
	memoryState.WithClock(clk)

	numberOfTestRequests := 3
	strategy := &quota_resource.StrategyConfig{
		FixedWindow: &quota_resource.FixedWindowConfig{
			QuotaLimit: quota_resource.QuotaLimit{
				Max:          1,
				Interval:     10,
				IntervalUnit: "minute",
			},
		},
	}
	quotaID := "test2"
	resourceMng, err := resources.NewResourceManagement()
	require.NoError(t, err)
	resourceMng, err = resourceMng.WithQuotaData(getQuotaData(strategy, quotaID))
	require.NoError(t, err)

	metaData := &stream_types.ProcessorMetaData{
		Name:                quotaID,
		Clock:               clk,
		SharedMemory:        memoryState,
		ProcessorDefinition: stream_types.ProcessorDefinition{},
		Parameters: map[string]stream_types.ProcessorParam{
			"quota_id": {
				Name:  "quota_id",
				Value: getParamValue("quota_id", quotaID),
			},
			"queue_size": {
				Name:  "queue_size",
				Value: getParamValue("queue_size", 1),
			},
			"redis_queue_size": {
				Name:  "redis_queue_size",
				Value: getParamValue("redis_queue_size", -1),
			},
			"ttl_seconds": {
				Name:  "ttl_seconds",
				Value: getParamValue("ttl_seconds", 5),
			},
			"priority_group_by_header": {
				Name:  "priority_group_by_header",
				Value: getParamValue("priority_group_by_header", nil),
			},
			"priority_groups": {
				Name:  "priority_groups",
				Value: getParamValue("priority_groups", nil),
			},
			"group_by_header": {
				Name:  "group_by_header",
				Value: getParamValue("group_by_header", "default"),
			},
		},
		Resources: resourceMng,
	}
	queueProcessor, err := queue_processor.NewProcessor(metaData)
	require.NoError(t, err)

	resultChan := make(chan result, numberOfTestRequests)
	defer close(resultChan)

	for i := 0; i < numberOfTestRequests; i++ {
		wg.Add(1)
		APIStream := getAPIStream()
		go execute(APIStream, queueProcessor, resultChan, &wg)
	}

	wg.Wait()

	results := make([]result, numberOfTestRequests)
	for i := 0; i < numberOfTestRequests; i++ {
		results[i] = <-resultChan
	}

	resultPrediction := map[string]int{
		allowedKey: 1, // Expected to be allowed
		blockedKey: 2, // Expected to be blocked
	}

	for _, res := range results {
		require.NotNil(t, res.procIO)
		resultPrediction[res.procIO.Name]--
	}

	for predictionType, count := range resultPrediction {
		require.Equal(t, 0, count, "Unexpected result count for prediction: %s", predictionType)
	}
}

func TestQueueProcessor_DrainRequestsWhenContextClose(t *testing.T) {
	var wg sync.WaitGroup

	t.Cleanup(func() {
		wg.Wait()
	})

	memoryState := lunar_context.NewMemoryState[string]()

	clk := context_manager.Get().SetRealClock().GetClock()
	numberOfTestRequests := 3
	strategy := &quota_resource.StrategyConfig{
		FixedWindow: &quota_resource.FixedWindowConfig{
			QuotaLimit: quota_resource.QuotaLimit{
				Max:          0,
				Interval:     10,
				IntervalUnit: "second",
			},
		},
	}
	quotaID := "test2"
	resources, _ := resources.NewResourceManagement()
	resources, _ = resources.WithQuotaData(getQuotaData(strategy, quotaID))
	metaData := &stream_types.ProcessorMetaData{
		Name:                quotaID,
		Clock:               clk,
		SharedMemory:        memoryState.WithClock(clk),
		ProcessorDefinition: stream_types.ProcessorDefinition{},
		Parameters: map[string]stream_types.ProcessorParam{
			"quota_id": {
				Name:  "quota_id",
				Value: getParamValue("quota_id", quotaID),
			},
			"queue_size": {
				Name:  "queue_size",
				Value: getParamValue("queue_size", 4),
			},
			"redis_queue_size": {
				Name:  "redis_queue_size",
				Value: getParamValue("redis_queue_size", -1),
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
			"group_by_header": {
				Name:  "group_by_header",
				Value: getParamValue("group_by_header", "default"),
			},
		},
		Resources: resources,
	}
	queueProcessor, err := queue_processor.NewProcessor(metaData)
	require.NoError(t, err)

	resultChan := make(chan result, numberOfTestRequests)
	defer close(resultChan)
	APIStreams := make([]public_types.APIStreamI, numberOfTestRequests)

	// generate APIStreams for testing
	for i := 0; i < numberOfTestRequests; i++ {
		APIStreams[i] = getAPIStream()
	}

	// Execute the APIStreams
	for i := 0; i < numberOfTestRequests; i++ {
		wg.Add(1)
		go execute(APIStreams[i], queueProcessor, resultChan, &wg)
	}

	// Wait for all results to be processed
	results := make([]result, numberOfTestRequests)

	ctx, cancelCtx := signal.NotifyContext(context.Background(),
		os.Interrupt, os.Kill, syscall.SIGTTIN, syscall.SIGTERM)

	ctxMng := context_manager.Get()
	ctxMng.WithContext(ctx)
	cancelCtx() // We close the context here to simulate a closed context.

	for i := 0; i < 3; i++ {
		results[i] = <-resultChan
	}

	resultPrediction := map[string]int{
		allowedKey: 0, // Expected to be allowed
		blockedKey: 3, // Expected to be blocked
	}

	for _, res := range results {
		require.NotNil(t, res.procIO)
		fmt.Println(res.procIO.Name)
		resultPrediction[res.procIO.Name]--
	}

	for predictionType, count := range resultPrediction {
		require.Equal(t, 0, count, "Unexpected result count for prediction: %s", predictionType)
	}
}

type result struct {
	procIO    stream_types.ProcessorIO
	err       error
	RequestID string
}

func execute(
	APIStream public_types.APIStreamI,
	processor stream_types.ProcessorI,
	resultChan chan result,
	wg *sync.WaitGroup,
) {
	defer wg.Done()
	procIO, err := processor.Execute("", APIStream)
	resultChan <- result{procIO, err, APIStream.GetID()}
}
