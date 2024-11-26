//go:build !pro

package doctor

import (
	"context"
	"lunar/engine/config"
	"lunar/engine/utils/obfuscation"
	"lunar/toolkit-core/clock"

	"github.com/rs/zerolog"
)

type Doctor struct {
	clock                  clock.Clock
	logger                 zerolog.Logger
	getTxnPoliciesAccessor func() *config.TxnPoliciesAccessor
	hasher                 obfuscation.MD5Hasher // ideally this would be found somewhere more generic
}

func NewDoctor(
	_ context.Context,
	getTxnPoliciesAccessor func() *config.TxnPoliciesAccessor,
	clock clock.Clock,
	logger zerolog.Logger,
) (*Doctor, error) {
	hasher := obfuscation.MD5Hasher{}
	return &Doctor{
		getTxnPoliciesAccessor: getTxnPoliciesAccessor,
		hasher:                 hasher,
		clock:                  clock,
		logger:                 logger.With().Str("component", "doctor").Logger(),
	}, nil
}

func (dr *Doctor) Run() Report {
	runAt := dr.clock.Now()
	return Report{
		RunAt:          runAt,
		Env:            getEnvReport(),
		ActivePolicies: dr.getActivePolicies(),
	}
}

func (dr *Doctor) getActivePolicies() ActivePolicies {
	return getActivePolicies(dr.getTxnPoliciesAccessor, dr.logger, dr.hasher)
}
