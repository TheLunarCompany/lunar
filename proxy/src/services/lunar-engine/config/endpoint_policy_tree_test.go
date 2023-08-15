package config_test

import (
	"lunar/engine/config"
	sharedConfig "lunar/shared-model/config"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGivenValidEndpointBuildPolicyTreeIsSuccessful(t *testing.T) {
	t.Parallel()
	endpoint := endpoint(remedy())
	policiesConfig := &sharedConfig.PoliciesConfig{
		Endpoints: []sharedConfig.EndpointConfig{endpoint},
	}

	tree, err := config.BuildEndpointPolicyTree(policiesConfig.Endpoints)
	assert.Nil(t, err)
	assert.NotNil(t, tree)
}

func TestGivenInvalidEndpointBuildPolicyTreeReturnsError(t *testing.T) {
	t.Parallel()
	endpoint := invalidEndpoint(remedy())
	policiesConfig := &sharedConfig.PoliciesConfig{
		Endpoints: []sharedConfig.EndpointConfig{endpoint},
	}

	_, err := config.BuildEndpointPolicyTree(policiesConfig.Endpoints)
	assert.NotNil(t, err)
}

func TestGivenDuplicateEndpointsWithTheSameRemedyBuildPolicyTreeReturnsError(
	t *testing.T,
) {
	t.Parallel()
	remedy := remedy()
	endpoint := endpoint(remedy)
	policiesConfig := &sharedConfig.PoliciesConfig{
		Endpoints: []sharedConfig.EndpointConfig{endpoint, endpoint},
	}
	_, err := config.BuildEndpointPolicyTree(policiesConfig.Endpoints)
	assert.NotNil(t, err)
}

func TestGivenOneEndpointWithTheSameRemedyTwiceBuildPolicyTreeReturnsError(
	t *testing.T,
) {
	t.Parallel()
	remedy := remedy()
	endpoint := endpointWithMultipleRemedies(
		[]sharedConfig.Remedy{remedy, remedy},
	)
	policiesConfig := &sharedConfig.PoliciesConfig{
		Endpoints: []sharedConfig.EndpointConfig{endpoint},
	}
	_, err := config.BuildEndpointPolicyTree(policiesConfig.Endpoints)
	assert.NotNil(t, err)
}

func TestGivenDuplicateEndpointsWithDifferentRemedyBuildPolicyTreeIsSuccessful(
	t *testing.T,
) {
	t.Parallel()
	endpoint1 := endpoint(remedy())
	endpoint2 := endpoint(otherRemedy())
	policiesConfig := &sharedConfig.PoliciesConfig{
		Endpoints: []sharedConfig.EndpointConfig{endpoint1, endpoint2},
	}
	tree, err := config.BuildEndpointPolicyTree(policiesConfig.Endpoints)
	assert.Nil(t, err)
	assert.NotNil(t, tree)
}

func TestGivenOverlappingEndpointsWithTheSameRemedyTypeBuildPolicyTreeReturnsError( //nolint:lll
	t *testing.T,
) {
	t.Parallel()
	endpoint1 := pathParamEndpoint(remedy())
	endpoint2 := endpoint(remedy())
	policiesConfig := &sharedConfig.PoliciesConfig{
		Endpoints: []sharedConfig.EndpointConfig{endpoint1, endpoint2},
	}
	_, err := config.BuildEndpointPolicyTree(policiesConfig.Endpoints)
	assert.NotNil(t, err)
}

func TestGivenOverlappingEndpointsWithDifferentRemedyTypeBuildPolicyTreeIsSuccessful( //nolint:lll
	t *testing.T,
) {
	t.Parallel()
	endpoint1 := pathParamEndpoint(remedy())
	endpoint2 := endpoint(otherRemedy())
	policiesConfig := &sharedConfig.PoliciesConfig{
		Endpoints: []sharedConfig.EndpointConfig{endpoint1, endpoint2},
	}
	tree, err := config.BuildEndpointPolicyTree(policiesConfig.Endpoints)
	assert.Nil(t, err)
	assert.NotNil(t, tree)
}

func TestGivenOverlappingWildcardEndpointWithTheSameRemedyTypeBuildPolicyTreeReturnsError( //nolint:lll
	t *testing.T,
) {
	t.Parallel()
	endpoint1 := wildcardEndpoint(remedy())
	endpoint2 := endpoint(remedy())
	policiesConfig := &sharedConfig.PoliciesConfig{
		Endpoints: []sharedConfig.EndpointConfig{endpoint1, endpoint2},
	}
	_, err := config.BuildEndpointPolicyTree(policiesConfig.Endpoints)
	assert.NotNil(t, err)
}

func TestGivenOverlappingEndpointsWithDifferentRemedyTypesBuildPolicyTreeIsSuccessful( //nolint:lll
	t *testing.T,
) {
	t.Parallel()
	endpoint1 := wildcardEndpoint(remedy())
	endpoint2 := endpoint(otherRemedy())
	policiesConfig := &sharedConfig.PoliciesConfig{
		Endpoints: []sharedConfig.EndpointConfig{endpoint1, endpoint2},
	}
	tree, err := config.BuildEndpointPolicyTree(policiesConfig.Endpoints)
	assert.Nil(t, err)
	assert.NotNil(t, tree)
}

func endpoint(remedy sharedConfig.Remedy) sharedConfig.EndpointConfig {
	return sharedConfig.EndpointConfig{
		Method:    "GET",
		URL:       "twitter.com/user/1234",
		Remedies:  []sharedConfig.Remedy{remedy},
		Diagnosis: []sharedConfig.Diagnosis{},
	}
}

func endpointWithMultipleRemedies(
	remedies []sharedConfig.Remedy,
) sharedConfig.EndpointConfig {
	return sharedConfig.EndpointConfig{
		Method:    "GET",
		URL:       "twitter.com/user/1234",
		Remedies:  remedies,
		Diagnosis: []sharedConfig.Diagnosis{},
	}
}

func invalidEndpoint(remedy sharedConfig.Remedy) sharedConfig.EndpointConfig {
	// Wildcard is only allowed at the end of the path
	return sharedConfig.EndpointConfig{
		Method:    "GET",
		URL:       "twitter.com/user/*/1234",
		Remedies:  []sharedConfig.Remedy{remedy},
		Diagnosis: []sharedConfig.Diagnosis{},
	}
}

func wildcardEndpoint(remedy sharedConfig.Remedy) sharedConfig.EndpointConfig {
	return sharedConfig.EndpointConfig{
		Method:    "GET",
		URL:       "twitter.com/user/*",
		Remedies:  []sharedConfig.Remedy{remedy},
		Diagnosis: []sharedConfig.Diagnosis{},
	}
}

func pathParamEndpoint(remedy sharedConfig.Remedy) sharedConfig.EndpointConfig {
	return sharedConfig.EndpointConfig{
		Method:    "GET",
		URL:       "twitter.com/user/{userID}",
		Remedies:  []sharedConfig.Remedy{remedy},
		Diagnosis: []sharedConfig.Diagnosis{},
	}
}

func remedy() sharedConfig.Remedy {
	return sharedConfig.Remedy{
		Enabled: true,
		Name:    "Remedy1",
		Config: sharedConfig.RemedyConfig{
			ResponseBasedThrottling: &sharedConfig.ResponseBasedThrottlingConfig{
				QuotaGroup:       1,
				RetryAfterHeader: "Retry-After",
				RetryAfterType:   sharedConfig.RetryAfterRelativeSeconds,
				RelevantStatuses: []int{429},
			},
		},
	}
}

func otherRemedy() sharedConfig.Remedy {
	return sharedConfig.Remedy{
		Enabled: true,
		Name:    "Remedy2",
		Config: sharedConfig.RemedyConfig{
			Caching: &sharedConfig.CachingConfig{
				RequestKeys: "user.id",
				TTLSeconds:  60,
				MaxBytes:    1000,
			},
		},
	}
}
