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

func TestGivenOverlappingEndpointsWithTheSameRemedyTypeBuildPolicyTreeReturnsError(
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

func TestGivenOverlappingEndpointsWithDifferentRemedyTypeBuildPolicyTreeIsSuccessful(
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

func TestGivenOverlappingWildcardEndpointWithTheSameRemedyTypeBuildPolicyTreeReturnsError(
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

func TestGivenOverlappingEndpointsWithDifferentRemedyTypesBuildPolicyTreeIsSuccessful(
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

func TestGivenSameURLWithDifferentMethodsBothAreInserted(t *testing.T) {
	t.Parallel()
	endpoint1 := endpoint(remedy())
	endpoint2 := sharedConfig.EndpointConfig{
		Method:    "POST",
		URL:       "twitter.com/user/1234",
		Remedies:  []sharedConfig.Remedy{otherRemedy()},
		Diagnosis: []sharedConfig.Diagnosis{},
	}
	policiesConfig := &sharedConfig.PoliciesConfig{
		Endpoints: []sharedConfig.EndpointConfig{endpoint1, endpoint2},
	}
	tree, err := config.BuildEndpointPolicyTree(policiesConfig.Endpoints)
	assert.Nil(t, err)
	assert.NotNil(t, tree)

	treeValue := tree.Lookup("twitter.com/user/1234")
	assert.NotNil(t, treeValue)
	assert.NotNil(t, treeValue.Value)
	methodToPolicyMap := *treeValue.Value

	getPolicy := methodToPolicyMap["GET"]
	assert.NotNil(t, getPolicy)
	assert.Equal(t, "twitter.com/user/1234", getPolicy.URL)
	assert.Equal(t, 1, len(getPolicy.Remedies))
	assert.Equal(t, "Remedy1", getPolicy.Remedies[0].Name)

	postPolicy := methodToPolicyMap["POST"]
	assert.NotNil(t, postPolicy)
	assert.Equal(t, "twitter.com/user/1234", postPolicy.URL)
	assert.Equal(t, 1, len(postPolicy.Remedies))
	assert.Equal(t, "Remedy2", postPolicy.Remedies[0].Name)
}

func endpoint(remedy sharedConfig.Remedy) sharedConfig.EndpointConfig {
	return sharedConfig.EndpointConfig{
		Method:    "GET",
		URL:       "twitter.com/user/1234",
		Remedies:  []sharedConfig.Remedy{remedy},
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
				RequestPayloadPaths: []sharedConfig.PayloadPath{
					{
						PayloadType: "path_param",
						Path:        "user.id",
					},
				},
				TTLSeconds:         float32(60),
				MaxRecordSizeBytes: 1000,
			},
		},
	}
}
