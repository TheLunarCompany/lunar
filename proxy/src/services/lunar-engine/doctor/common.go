package doctor

import (
	"lunar/engine/config"
	"lunar/engine/utils/environment"
	"lunar/engine/utils/obfuscation"
	"lunar/toolkit-core/network"
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

// A model-mapping function
func getLoadedStreamsConfig(
	getLoadedStreamsConfigF func() *network.ConfigurationData,
	logger zerolog.Logger,
	hasher obfuscation.MD5Hasher,
) LoadedStreamsConfig {
	if getLoadedStreamsConfigF == nil {
		logger.Debug().Msg("getLoadedStreamsConfigF is nil")
		return LoadedStreamsConfig{}
	}
	configData := getLoadedStreamsConfigF()
	if configData == nil {
		logger.Debug().Msg("configData is nil")
		return LoadedStreamsConfig{}
	}

	configurationPayloads := make([]ConfigurationPayload, 0)
	for _, payload := range configData.Data {
		md5 := hasher.HashBytes(payload.Content)
		configurationPayloads = append(configurationPayloads, ConfigurationPayload{
			Type:     payload.Type,
			FileName: payload.FileName,
			Content:  string(payload.Content),
			MD5:      md5,
		})
	}
	return LoadedStreamsConfig{
		Data: configurationPayloads,
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
	yamlData, marshalErr := yaml.Marshal(policies.Config)
	if marshalErr != nil {
		logger.Debug().Err(marshalErr).Msg("failed to marshal policies yaml")
		return []byte{}
	}
	return yamlData
}

func getHubReport(getLastSuccessfulHubCommunication TimestampAccessF) HubReport {
	lastSuccessfulCommunication := getLastSuccessfulHubCommunication()
	if lastSuccessfulCommunication == nil {
		return HubReport{}
	}
	minutesSinceLastSuccessfulCommunication := time.Since(*lastSuccessfulCommunication).Minutes()
	return HubReport{
		LastSuccessfulCommunication:             lastSuccessfulCommunication,
		MinutesSinceLastSuccessfulCommunication: &minutesSinceLastSuccessfulCommunication,
	}
}
