package resources

import (
	streamconfig "lunar/engine/streams/config"
	publictypes "lunar/engine/streams/public-types"
	quotaresource "lunar/engine/streams/resources/quota"
	resourceutils "lunar/engine/streams/resources/utils"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadQuotaResources(t *testing.T) {
	quotaData := generateQuotaRepresentation()

	resourceManagement := &ResourceManagement{
		quotas:   resourceutils.NewResource[quotaresource.QuotaAdmI](),
		flowData: make(map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation),
	}
	quotaLoader, err := quotaresource.NewLoader()
	require.NoError(t, err)
	resourceManagement.quotaLoader = quotaLoader

	resourceManagement, err = resourceManagement.WithQuotaData(quotaData)
	require.NoError(t, err)

	for _, quota := range quotaData {
		loadedQuota, found := resourceManagement.quotas.Get(quota.Quota.ID)
		assert.True(t, found)
		assert.Equal(t, loadedQuota.GetMetaData().Quota.Filter, quota.Quota.Filter)
		assert.Equal(t, loadedQuota.GetMetaData().Quota.ID, quota.Quota.ID)
		assert.Equal(t, loadedQuota.GetMetaData().Quota.Strategy, quota.Quota.Strategy)
	}
}

func TestSystemFlowAvailability(t *testing.T) {
	quotaData := generateQuotaRepresentation()

	resourceManagement := &ResourceManagement{
		quotas:   resourceutils.NewResource[quotaresource.QuotaAdmI](),
		flowData: make(map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation),
	}
	quotaLoader, err := quotaresource.NewLoader()
	require.NoError(t, err)
	resourceManagement.quotaLoader = quotaLoader
	resourceManagement, err = resourceManagement.WithQuotaData(quotaData)
	require.NoError(t, err)

	for _, quota := range quotaData {
		generatedSystemFlow, _ := resourceManagement.GetFlowData(quota.Quota.Filter.ToComparable())
		assert.NotNil(t, generatedSystemFlow)
	}
}

func generateQuotaRepresentation() []*quotaresource.QuotaResourceData {
	return []*quotaresource.QuotaResourceData{
		{
			Quota: &quotaresource.QuotaConfig{
				ID:       "quota1",
				Filter:   generateFilter(0),
				Strategy: generateQuotaStrategy(0),
			},
		},
		{
			Quota: &quotaresource.QuotaConfig{
				ID:       "quota2",
				Filter:   generateFilter(1),
				Strategy: generateQuotaStrategy(1),
			},
		},
		{
			Quota: &quotaresource.QuotaConfig{
				ID:       "quota3",
				Filter:   generateFilter(2),
				Strategy: generateQuotaStrategy(2),
			},
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

func generateQuotaStrategy(_ int) *quotaresource.StrategyConfig {
	useCase := 0 // Remove when we support other strategies
	switch useCase {
	case 0:
		return &quotaresource.StrategyConfig{
			FixedWindow: &quotaresource.FixedWindowConfig{
				QuotaLimit: quotaresource.QuotaLimit{
					Max:          1,
					Interval:     10,
					IntervalUnit: "hour",
				},
			},
		}
	case 1:
		return &quotaresource.StrategyConfig{
			Concurrent: &quotaresource.ConcurrentConfig{
				QuotaLimit: quotaresource.QuotaLimit{
					Max:          1,
					Interval:     10,
					IntervalUnit: "hour",
				},
			},
		}
	case 2:
		return &quotaresource.StrategyConfig{
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
