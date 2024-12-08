package doctor

import (
	"lunar/engine/config"
	"lunar/engine/utils/environment"
	"lunar/engine/utils/obfuscation"
	"time"

	"github.com/rs/zerolog"
	"gopkg.in/yaml.v2"
)

type TimestampAccessF = func() *time.Time

func getEnvReport() EnvReport {
	return EnvReport{
		LogLevel:                environment.GetLogLevel(),
		IsEngineFailsafeEnabled: environment.IsEngineFailsafeEnabled(),
	}
}

func getActivePolicies(getTxnPoliciesAccessor func() *config.TxnPoliciesAccessor,
	logger zerolog.Logger, hasher obfuscation.MD5Hasher,
) ActivePolicies {
	yamlBytes := getActivePoliciesYAML(getTxnPoliciesAccessor, logger)
	md5 := hasher.HashBytes(yamlBytes)
	yamlStr := string(yamlBytes)
	return ActivePolicies{
		YAML: yamlStr,
		MD5:  md5,
	}
}

func getActivePoliciesYAML(
	getTxnPoliciesAccessor func() *config.TxnPoliciesAccessor,
	logger zerolog.Logger,
) []byte {
	if getTxnPoliciesAccessor == nil {
		logger.Debug().Msg("getTxnPoliciesAccessor is nil")
		return []byte{}
	}
	policiesAccessor := getTxnPoliciesAccessor()
	if policiesAccessor == nil {
		logger.Debug().Msg("policies accessor is nil")
		return []byte{}
	}
	policies := policiesAccessor.GetCurrentPoliciesData()
	if policies == nil {
		logger.Debug().Msg("policies is nil")
		return []byte{}
	}
	yamlData, marshalErr := yaml.Marshal(policies)
	if marshalErr != nil {
		logger.Debug().Err(marshalErr).Msg("failed to marshal policies yaml")
		return []byte{}
	}
	return yamlData
}
