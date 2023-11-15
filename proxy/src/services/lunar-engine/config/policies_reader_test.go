package config_test

import (
	"lunar/engine/config"
	sharedConfig "lunar/shared-model/config"
	"testing"

	"github.com/stretchr/testify/assert"
)

func initStructLevelValidations() {
	sharedConfig.Validate.RegisterStructValidation(
		config.ValidateStructLevel,
		sharedConfig.Remedy{},
		sharedConfig.Diagnosis{},
		sharedConfig.PoliciesConfig{},
	)
}

func buildStrategyBasedThrottling(
	name string,
	windowSize int,
) sharedConfig.Remedy {
	return sharedConfig.Remedy{
		Enabled: true, Name: name,
		Config: sharedConfig.RemedyConfig{
			StrategyBasedThrottling: &sharedConfig.StrategyBasedThrottlingConfig{
				WindowSizeInSeconds: windowSize,
			},
		},
	}
}

func buildPoliciesConfigForDuplicateNameTesting(
	nameA string,
	nameB string,
) sharedConfig.PoliciesConfig {
	return sharedConfig.PoliciesConfig{
		Global: sharedConfig.Global{Remedies: []sharedConfig.Remedy{
			{
				Enabled: true, Name: nameA,
				Config: sharedConfig.RemedyConfig{
					StrategyBasedThrottling: &sharedConfig.StrategyBasedThrottlingConfig{
						WindowSizeInSeconds: 10,
					},
				},
			},
		}},
		Endpoints: []sharedConfig.EndpointConfig{
			{
				URL: "api.com", Method: "GET",
				Diagnosis: []sharedConfig.Diagnosis{
					{
						Enabled: true, Name: nameB,
						Config: sharedConfig.DiagnosisConfig{
							Void: &sharedConfig.VoidConfig{},
						},
						Export: "prometheus",
					},
				},
			},
		},
	}
}

func TestValidateFailsIfChainedSBTRemediesWindowsHaveNoCommonDenominator(
	t *testing.T,
) {
	initStructLevelValidations()

	policiesConfig := sharedConfig.PoliciesConfig{
		Global: sharedConfig.Global{Remedies: []sharedConfig.Remedy{
			buildStrategyBasedThrottling("foo", 5),
			buildStrategyBasedThrottling("bar", 6),
		}},
	}
	err := config.Validate(&policiesConfig)
	assert.Error(t, err)
}

func TestValidateSucceedsIfChainedSBTRemediesWindowsHaveCommonDenominator(
	t *testing.T,
) {
	initStructLevelValidations()

	policiesConfig := sharedConfig.PoliciesConfig{
		Global: sharedConfig.Global{Remedies: []sharedConfig.Remedy{
			buildStrategyBasedThrottling("foo", 5),
			buildStrategyBasedThrottling("bar", 1200),
		}},
	}
	err := config.Validate(&policiesConfig)
	assert.Nil(t, err)
}

func TestValidateSucceedsIfUnchainedSBTRemediesWindowsHaveNoCommonDenominator(
	t *testing.T,
) {
	initStructLevelValidations()

	policiesConfig := sharedConfig.PoliciesConfig{
		Endpoints: []sharedConfig.EndpointConfig{
			{
				URL: "api.com", Method: "GET",
				Remedies: []sharedConfig.Remedy{
					buildStrategyBasedThrottling("foo", 6),
				},
			},
			{
				URL: "api.com", Method: "POST",
				Remedies: []sharedConfig.Remedy{
					buildStrategyBasedThrottling("bar", 5),
				},
			},
		},
	}
	err := config.Validate(&policiesConfig)
	assert.Nil(t, err)
}

func TestValidateFailsIfNoTwoPoliciesShareTheSameName(
	t *testing.T,
) {
	initStructLevelValidations()

	policiesConfig := buildPoliciesConfigForDuplicateNameTesting(
		"some name",
		"some other name",
	)
	err := config.Validate(&policiesConfig)
	assert.Nil(t, err)
}

func TestValidateFailsIfTwoPoliciesShareTheSameName(
	t *testing.T,
) {
	initStructLevelValidations()

	policiesConfig := buildPoliciesConfigForDuplicateNameTesting(
		"some name",
		"some name",
	)
	err := config.Validate(&policiesConfig)
	assert.Error(t, err)
}

func TestValidateFailsIfCachePolicyMissingPathParam(
	t *testing.T,
) {
	initStructLevelValidations()

	policiesConfig := sharedConfig.PoliciesConfig{
		Endpoints: []sharedConfig.EndpointConfig{
			{
				URL:    "random-word.ryanrk.com/api/{language}/word/random",
				Method: "GET",
				Remedies: []sharedConfig.Remedy{
					{
						Enabled: true,
						Name:    "testing cache validation",
						Config:  buildRemedyConfigForCachePluginTesting([]string{"bla"}),
					},
				},
			},
		},
	}
	err := config.Validate(&policiesConfig)
	assert.Error(t, err)
}

func TestCachePolicy(
	t *testing.T,
) {
	initStructLevelValidations()

	policiesConfig := sharedConfig.PoliciesConfig{
		Endpoints: []sharedConfig.EndpointConfig{
			{
				URL:    "random-word.ryanrk.com/api/{language}/word/random",
				Method: "GET",
				Remedies: []sharedConfig.Remedy{
					{
						Enabled: true,
						Name:    "testing cache validation",
						Config:  buildRemedyConfigForCachePluginTesting([]string{"language"}),
					},
				},
			},
		},
	}
	err := config.Validate(&policiesConfig)
	assert.Nil(t, err)
}

func buildRemedyConfigForCachePluginTesting(
	pathParams []string,
) sharedConfig.RemedyConfig {
	var requestPayloadPaths []sharedConfig.PayloadPath
	for _, path := range pathParams {
		requestPayloadPaths = append(requestPayloadPaths, sharedConfig.PayloadPath{
			PayloadType: sharedConfig.PayloadRequestPathParams.String(),
			Path:        path,
		})
	}

	cachingConfig := sharedConfig.CachingConfig{
		RequestPayloadPaths:   requestPayloadPaths,
		TTLSeconds:            60.0,
		MaxRecordSizeBytes:    1024,
		MaxCacheSizeMegabytes: 100.0,
	}

	return sharedConfig.RemedyConfig{
		Caching: &cachingConfig,
	}
}
