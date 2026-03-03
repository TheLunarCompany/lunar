package quotaresource

import (
	"fmt"
	publictypes "lunar/engine/streams/public-types"
	resourcetypes "lunar/engine/streams/resources/types"
	resourceutils "lunar/engine/streams/resources/utils"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var _ publictypes.QuotaResourceI = &headerBasedStrategy{}

type headerBasedStrategy struct {
	quotaID        string
	logger         zerolog.Logger
	systemFlowData *resourcetypes.ResourceFlowData
	strategyConfig *StrategyConfig
}

func NewHeaderBasedStrategy(
	providerCfg *QuotaConfig,
	_ *resourceutils.QuotaNode[ResourceAdmI],
) (ResourceAdmI, error) {
	if providerCfg.Strategy.HeaderBased == nil {
		return nil, fmt.Errorf("header based strategy config is nil")
	}

	return &headerBasedStrategy{
		quotaID:        providerCfg.ID,
		logger:         log.Logger.With().Str("component", "header-based-strategy").Logger(),
		strategyConfig: providerCfg.Strategy,
	}, nil
}

func (hs *headerBasedStrategy) GetSystemFlow() *resourcetypes.ResourceFlowData {
	return hs.systemFlowData
}

func (hs *headerBasedStrategy) GetStrategyConfig() *StrategyConfig {
	return hs.strategyConfig
}

func (hs *headerBasedStrategy) GetParentID() string {
	return ""
}

func (hs *headerBasedStrategy) Allowed(_ publictypes.APIStreamI) (bool, error) {
	return true, nil
}

func (hs *headerBasedStrategy) Dec(_ publictypes.APIStreamI) error {
	return nil
}

func (hs *headerBasedStrategy) Inc(_ publictypes.APIStreamI) error {
	return nil
}

func (hs *headerBasedStrategy) ResetIn() time.Duration {
	return time.Duration(0)
}

func (hs *headerBasedStrategy) GetGroupedBy() string {
	return DefaultGroup
}

func (hs *headerBasedStrategy) GetID() string {
	return hs.quotaID
}

func (hs *headerBasedStrategy) GetLimit() int64 {
	return 0
}

func (hs *headerBasedStrategy) GetQuotaGroupsCounters() map[string]int64 {
	return make(map[string]int64)
}
