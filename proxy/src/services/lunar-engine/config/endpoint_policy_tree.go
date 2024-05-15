package config

import (
	"errors"
	"fmt"
	sharedConfig "lunar/shared-model/config"
	"lunar/toolkit-core/urltree"

	"github.com/rs/zerolog/log"
)

type EndpointPolicy struct {
	URL       string
	Remedies  []sharedConfig.Remedy
	Diagnosis []sharedConfig.Diagnosis
}

type EndpointPolicyTree = urltree.EndpointTree[EndpointPolicy]

func BuildEndpointPolicyTree(
	endpoints []sharedConfig.EndpointConfig,
) (*EndpointPolicyTree, error) {
	endpointPolicyTree := newEndpointPolicyTree()
	for _, endpoint := range endpoints {
		err := checkForDuplicates(endpointPolicyTree, endpoint)
		if err != nil {
			return nil, err
		}
		endpointPolicy := &map[urltree.Method]EndpointPolicy{
			urltree.Method(endpoint.Method): {
				URL:       endpoint.URL,
				Remedies:  endpoint.Remedies,
				Diagnosis: endpoint.Diagnosis,
			},
		}
		err = endpointPolicyTree.Insert(endpoint.URL, endpointPolicy)
		if err != nil {
			joinedErr := errors.Join(fmt.Errorf(
				"failed to build endpoint policy tree. Error in endpoint %v %v",
				endpoint.Method,
				endpoint.URL,
			), err)
			return nil, joinedErr
		}
	}
	return endpointPolicyTree, nil
}

func newEndpointPolicyTree() *EndpointPolicyTree {
	return urltree.NewEndpointTree[EndpointPolicy]()
}

func checkForDuplicates(
	policyTree *urltree.EndpointTree[EndpointPolicy],
	endpoint sharedConfig.EndpointConfig,
) error {
	remedies, existingURL := existingRemedies(
		policyTree,
		endpoint.Method,
		endpoint.URL,
	)
	for _, remedy := range endpoint.Remedies {
		for _, existingRemedy := range remedies {
			if !existingRemedy.IsTypeUndefined() &&
				existingRemedy.Type() == remedy.Type() {
				return fmt.Errorf(
					"some URLs might match both \"%v\" and \"%v\" "+
						"This would cause a conflict between %v remedies \"%v\" and \"%v\"",
					endpoint.URL,
					existingURL,
					remedy.Type().String(),
					remedy.GetName(),
					existingRemedy.GetName(),
				)
			}
			log.Warn().Msgf("Some URLs might match both \"%v\" and \"%v\"."+
				"In that case remedies and diagnoses will run "+
				"in the order they are written",
				endpoint.URL,
				existingURL,
			)
		}
	}
	return nil
}

func existingRemedies(
	policyTree *urltree.EndpointTree[EndpointPolicy],
	methodArg string,
	url string,
) ([]sharedConfig.Remedy, string) {
	lookupResult := policyTree.Lookup(url)
	if lookupResult.Value == nil {
		return []sharedConfig.Remedy{}, ""
	}
	policy := *lookupResult.Value
	method := urltree.Method(methodArg)
	return policy[method].Remedies, policy[method].URL
}
