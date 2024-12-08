//go:build !pro

package doctor

import (
	"context"
	"lunar/engine/config"
	"lunar/engine/utils/obfuscation"
	"lunar/toolkit-core/clock"
	"sync"

	"github.com/rs/zerolog"
)

type Doctor struct {
	mutex                             *sync.Mutex
	clock                             clock.Clock
	logger                            zerolog.Logger
	getTxnPoliciesAccessor            func() *config.TxnPoliciesAccessor
	getLastSuccessfulHubCommunication TimestampAccessF
	hasher                            obfuscation.MD5Hasher // TODO: move somewhere more generic
}

func NewDoctor(
	_ context.Context,
	getTxnPoliciesAccessor func() *config.TxnPoliciesAccessor,
	getLastSuccessfulHubCommunication TimestampAccessF,
	clock clock.Clock,
	logger zerolog.Logger,
) (*Doctor, error) {
	hasher := obfuscation.MD5Hasher{}
	return &Doctor{
		mutex:                             &sync.Mutex{},
		getTxnPoliciesAccessor:            getTxnPoliciesAccessor,
		getLastSuccessfulHubCommunication: getLastSuccessfulHubCommunication,
		hasher:                            hasher,
		clock:                             clock,
		logger:                            logger.With().Str("component", "doctor").Logger(),
	}, nil
}

func (dr *Doctor) Run() Report {
	dr.mutex.Lock()
	defer dr.mutex.Unlock()

	runAt := dr.clock.Now()
	return Report{
		RunAt:          runAt,
		Env:            getEnvReport(),
		ActivePolicies: dr.getActivePolicies(),
		Hub:            dr.getHubReport(),
	}
}

func (dr *Doctor) getActivePolicies() ActivePolicies {
	return getActivePolicies(dr.getTxnPoliciesAccessor, dr.logger, dr.hasher)
}

func (dr *Doctor) getHubReport() HubReport {
	return HubReport{
		LastSuccessfulCommunication: dr.getLastSuccessfulHubCommunication(),
	}
}
