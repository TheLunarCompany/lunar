//go:build !pro

package doctor

import (
	"context"
	"lunar/engine/config"
	"lunar/engine/utils/obfuscation"
	"lunar/toolkit-core/clock"
	"lunar/toolkit-core/network"
	"sync"

	"github.com/rs/zerolog"
)

type Doctor struct {
	mutex                             *sync.Mutex
	clock                             clock.Clock
	logger                            zerolog.Logger
	isTypeConfigured                  bool // This flag ensures configuration occurs at most once
	isStreamsEnabled                  bool
	getTxnPoliciesAccessor            func() *config.TxnPoliciesAccessor
	getLoadedStreamsConfigF           func() *network.ConfigurationData
	getLastSuccessfulHubCommunication TimestampAccessF
	hasher                            obfuscation.MD5Hasher // TODO: move somewhere more generic
}

func NewDoctor(
	_ context.Context,
	getLastSuccessfulHubCommunication TimestampAccessF,
	clock clock.Clock,
	logger zerolog.Logger,
) (*Doctor, error) {
	hasher := obfuscation.MD5Hasher{}
	return &Doctor{
		mutex:                             &sync.Mutex{},
		getLastSuccessfulHubCommunication: getLastSuccessfulHubCommunication,
		hasher:                            hasher,
		clock:                             clock,
		logger:                            logger.With().Str("component", "doctor").Logger(),
	}, nil
}

func (dr *Doctor) WithStreams(getLoadedStreamsConfigF func() *network.ConfigurationData) *Doctor {
	dr.mutex.Lock()
	defer dr.mutex.Unlock()
	if dr.isTypeConfigured {
		dr.logger.Warn().Msg("Doctor already configured, will return original")
		return dr
	}
	dr.isTypeConfigured = true

	dr.isStreamsEnabled = true
	dr.getLoadedStreamsConfigF = getLoadedStreamsConfigF

	return dr
}

func (dr *Doctor) WithPolicies(getTxnPoliciesAccessor func() *config.TxnPoliciesAccessor) *Doctor {
	dr.mutex.Lock()
	defer dr.mutex.Unlock()
	if dr.isTypeConfigured {
		dr.logger.Warn().Msg("Doctor already configured, will return original")
		return dr
	}
	dr.isTypeConfigured = true

	dr.getTxnPoliciesAccessor = getTxnPoliciesAccessor

	return dr
}

func (dr *Doctor) Run() Report {
	dr.mutex.Lock()
	defer dr.mutex.Unlock()

	if !dr.isTypeConfigured {
		dr.logger.Debug().Msg("Doctor not configured, will return empty report")
		return Report{}
	}

	runAt := dr.clock.Now()
	return Report{
		RunAt:               runAt,
		Env:                 getEnvReport(),
		IsStreamsEnabled:    dr.isStreamsEnabled,
		ActivePolicies:      dr.getActivePolicies(),
		LoadedStreamsConfig: dr.getLoadedStreamsConfig(),
		Hub:                 getHubReport(dr.getLastSuccessfulHubCommunication),
	}
}

func (dr *Doctor) getActivePolicies() *ActivePolicies {
	if !dr.isStreamsEnabled {
		res := getActivePolicies(dr.getTxnPoliciesAccessor, dr.logger, dr.hasher)
		return &res
	}
	return nil
}

func (dr *Doctor) getLoadedStreamsConfig() *LoadedStreamsConfig {
	if dr.isStreamsEnabled {
		res := getLoadedStreamsConfig(dr.getLoadedStreamsConfigF, dr.logger, dr.hasher)
		return &res
	}
	return nil
}
