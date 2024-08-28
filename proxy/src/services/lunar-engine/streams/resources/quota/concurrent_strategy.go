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

var _ publictypes.QuotaResourceI = &concurrentStrategy{}

type concurrentStrategy struct {
	quotaID        string
	logger         zerolog.Logger
	systemFlowData *resourcetypes.ResourceFlowData
}

func NewConcurrentStrategy(
	providerCfg *QuotaConfig,
	_ *resourceutils.QuotaNode[ResourceAdmI],
) (ResourceAdmI, error) {
	if providerCfg.Strategy.Concurrent == nil {
		return nil, fmt.Errorf("concurrent strategy config is nil")
	}

	return &concurrentStrategy{
		quotaID: providerCfg.ID,
		logger:  log.Logger.With().Str("component", "concurrent").Logger(),
	}, nil
}

func (cs *concurrentStrategy) GetSystemFlow() *resourcetypes.ResourceFlowData {
	return cs.systemFlowData
}

func (cs *concurrentStrategy) Allowed(_ publictypes.APIStreamI) (bool, error) {
	return true, nil
}

func (cs *concurrentStrategy) Dec(_ publictypes.APIStreamI) error {
	return nil
}

func (cs *concurrentStrategy) Inc(_ publictypes.APIStreamI) error {
	return nil
}

func (cs *concurrentStrategy) ResetIn() time.Duration {
	return time.Duration(0)
}

func (cs *concurrentStrategy) GetGroupedBy() string {
	return DefaultGroup
}
