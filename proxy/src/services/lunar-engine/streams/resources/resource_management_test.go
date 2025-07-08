package resources

import (
	"fmt"
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

	for _, quotas := range quotaData {
		for _, singleQuota := range quotas.ToSingleQuotaResourceDataList() {
			loadedQuota, found := resourceManagement.quotas.Get(singleQuota.Quota.ID)
			assert.True(t, found)
			assert.Equal(t, loadedQuota.GetMetaData().Quota.Filter, singleQuota.Quota.Filter)
			assert.Equal(t, loadedQuota.GetMetaData().Quota.ID, singleQuota.Quota.ID)
			assert.Equal(t, loadedQuota.GetMetaData().Quota.Strategy, singleQuota.Quota.Strategy)
		}
	}
}

func TestLoadQuotaResourcesWithInternalLimits(t *testing.T) {
	quotaData := generateQuotaWithInternal()

	resourceManagement := &ResourceManagement{
		quotas:   resourceutils.NewResource[quotaresource.QuotaAdmI](),
		flowData: make(map[publictypes.ComparableFilter]*resourceutils.SystemFlowRepresentation),
	}
	quotaLoader, err := quotaresource.NewLoader()
	require.NoError(t, err)
	resourceManagement.quotaLoader = quotaLoader

	resourceManagement, err = resourceManagement.WithQuotaData(quotaData)
	require.NoError(t, err)

	for _, quotas := range quotaData {
		for _, singleQuota := range quotas.ToSingleQuotaResourceDataList() {
			loadedQuota, found := resourceManagement.quotas.Get(singleQuota.Quota.ID)
			fmt.Printf("Loaded IDs: %+v", loadedQuota.GetIDs())
			assert.True(t, found)
			assert.Equal(t, loadedQuota.GetMetaData().Quota.Filter, singleQuota.Quota.Filter)
			assert.Equal(t, loadedQuota.GetMetaData().Quota.ID, singleQuota.Quota.ID)
			assert.Equal(t, loadedQuota.GetMetaData().Quota.Strategy, singleQuota.Quota.Strategy)
		}
	}
}

func TestValidateInternalQuotaIDs(t *testing.T) {
	quotaData := generateQuotaWithInternal()
	for _, quotas := range quotaData {
		singleQuotaList := quotas.ToSingleQuotaResourceDataList()
		for _, quota := range singleQuotaList {
			counterInternalQuotas := 0
			for _, internalQuota := range quotas.InternalLimits {
				if internalQuota.ParentID == quota.Quota.ID {
					counterInternalQuotas++
				}
			}
			assert.Equal(t, counterInternalQuotas, len(quota.InternalLimits))
		}
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

	for _, quotas := range quotaData {
		for _, singleQuota := range quotas.ToSingleQuotaResourceDataList() {
			generatedSystemFlow, _ := resourceManagement.GetFlowData(singleQuota.Quota.Filter.ToComparable())
			assert.NotNil(t, generatedSystemFlow)
		}
	}
}

func generateQuotaWithInternal() []*quotaresource.QuotaResourceData {
	return []*quotaresource.QuotaResourceData{
		{
			Quotas: []*quotaresource.QuotaConfig{
				{
					ID:       "quota1",
					Filter:   generateFilter(3),
					Strategy: generateQuotaStrategy(0),
				},
				{
					ID:       "quota2",
					Filter:   generateFilter(4),
					Strategy: generateQuotaStrategy(1),
				},
			},
			InternalLimits: []*quotaresource.ChildQuotaConfig{
				{
					ParentID: "quota1",
					QuotaConfig: quotaresource.QuotaConfig{
						ID:       "internal_quota1",
						Filter:   generateFilter(5),
						Strategy: generateQuotaStrategy(2),
					},
				},
				{
					ParentID: "quota2",
					QuotaConfig: quotaresource.QuotaConfig{
						ID:       "internal_quota2",
						Filter:   generateFilter(6),
						Strategy: generateQuotaStrategy(2),
					},
				},
			},
		},
	}
}

func generateQuotaRepresentation() []*quotaresource.QuotaResourceData {
	return []*quotaresource.QuotaResourceData{
		{
			Quotas: []*quotaresource.QuotaConfig{
				{
					ID:       "quota1",
					Filter:   generateFilter(0),
					Strategy: generateQuotaStrategy(0),
				},
			},
		},
		{
			Quotas: []*quotaresource.QuotaConfig{
				{
					ID:       "quota2",
					Filter:   generateFilter(1),
					Strategy: generateQuotaStrategy(1),
				},
			},
		},
		{
			Quotas: []*quotaresource.QuotaConfig{
				{
					ID:       "quota3",
					Filter:   generateFilter(2),
					Strategy: generateQuotaStrategy(2),
				},
			},
		},
	}
}

func generateFilter(useCase int) *streamconfig.Filter {
	filter := &streamconfig.Filter{}
	switch useCase {
	case 0:
		filter.Methods = []string{"GET"}
		filter.URL = "api.example.com/"
	case 1:
		filter.Methods = []string{"POST"}
		filter.URL = "api.example.com/"
	case 2:
		filter.Methods = []string{"GET", "POST"}
		filter.URL = "api.example.com/"
	case 3:
		filter.URL = "api.example.com/v1"
	case 4:
		filter.URL = "api.example.com/v2"
	case 5:
		filter.Methods = []string{"GET"}
	case 6:
		filter.Methods = []string{"POST"}
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
				MaxRequestCount: 1,
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
