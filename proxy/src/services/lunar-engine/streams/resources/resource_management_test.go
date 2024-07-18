package resources

import (
	streamconfig "lunar/engine/streams/config"
	publictypes "lunar/engine/streams/public-types"
	quotaresource "lunar/engine/streams/resources/quota"
	resourceutils "lunar/engine/streams/resources/utils"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLoadQuotaResources(t *testing.T) {
	quotaData := generateQuotaRepresentation()

	resourceManagement := &ResourceManagement{
		quotas:   NewResource[*quotaresource.QuotaResource](),
		flowData: make(map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation),
	}

	err := resourceManagement.loadQuotaResources(quotaData)
	if err != nil {
		t.Errorf("Failed to load quota resources: %v", err)
	}

	for _, quota := range quotaData {
		loadedQuota, found := resourceManagement.quotas.Get(quota.ID)
		assert.True(t, found)
		assert.Equal(t, loadedQuota.GetMetaData().Filter, quota.Filter)
		assert.Equal(t, loadedQuota.GetMetaData().ID, quota.ID)
		assert.Equal(t, loadedQuota.GetMetaData().Strategy, quota.Strategy)
	}
}

func TestSystemFlowAvailability(t *testing.T) {
	quotaData := generateQuotaRepresentation()

	resourceManagement := &ResourceManagement{
		quotas:   NewResource[*quotaresource.QuotaResource](),
		flowData: make(map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation),
	}

	err := resourceManagement.loadQuotaResources(quotaData)
	if err != nil {
		t.Errorf("Failed to load quota resources: %v", err)
	}

	for _, quota := range quotaData {
		generatedSystemFlow, _ := resourceManagement.GetFlowData(quota.Filter.ToComparable())
		assert.NotNil(t, generatedSystemFlow)
	}
}

func TestUnReferencedSystemFlowAvailability(t *testing.T) {
	quotaData := generateQuotaRepresentation()

	resourceManagement := &ResourceManagement{
		quotas:   NewResource[*quotaresource.QuotaResource](),
		flowData: make(map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation),
	}

	err := resourceManagement.loadQuotaResources(quotaData)
	if err != nil {
		t.Errorf("Failed to load quota resources: %v", err)
	}

	for _, quota := range quotaData[1:] {
		generatedSystemFlow, _ := resourceManagement.GetFlowData(quota.Filter.ToComparable())
		templateFlow := generatedSystemFlow.GetFlowTemplate()
		templateFlow.Processors = make(map[string]streamconfig.Processor)
		_, err := generatedSystemFlow.AddSystemFlowToUserFlow(templateFlow)
		if err != nil {
			t.Errorf("Failed to add system flow to user flow: %v", err)
		}
	}
	assert.Equal(t, 1, len(resourceManagement.GetUnReferencedFlowData()))
}

func generateQuotaRepresentation() []*quotaresource.QuotaRepresentation {
	return []*quotaresource.QuotaRepresentation{
		{
			ID:       "quota1",
			Filter:   generateFilter(0),
			Strategy: generateQuotaStrategy(0),
		},
		{
			ID:       "quota2",
			Filter:   generateFilter(1),
			Strategy: generateQuotaStrategy(1),
		},
		{
			ID:       "quota3",
			Filter:   generateFilter(2),
			Strategy: generateQuotaStrategy(2),
		},
	}
}

func generateFilter(useCase int) *streamconfig.Filter {
	filter := &streamconfig.Filter{
		URL: "api.example.com",
	}
	switch useCase {
	case 0:
		filter.Method = []string{"GET"}
	case 1:
		filter.Method = []string{"POST"}
	case 2:
		filter.Method = []string{"GET", "POST"}
	}
	return filter
}

func generateQuotaStrategy(useCase int) *quotaresource.Strategy {
	switch useCase {
	case 0:
		return &quotaresource.Strategy{
			FixedWindow: &quotaresource.FixedWindowConfig{
				AllowedRequestsCount: 100,
				WindowSizeSeconds:    60,
			},
		}
	case 1:
		return &quotaresource.Strategy{
			Concurrent: &quotaresource.ConcurrentConfig{
				MaxRequestsCount: 10,
			},
		}
	case 2:
		return &quotaresource.Strategy{
			HeaderBased: &quotaresource.HeaderBasedConfig{
				QuotaHeader:      "X-RateLimit-Limit",
				ResetHeader:      "X-RateLimit-Reset",
				RetryAfterHeader: "Retry-After",
			},
		}
	default:
		return nil
	}
}
