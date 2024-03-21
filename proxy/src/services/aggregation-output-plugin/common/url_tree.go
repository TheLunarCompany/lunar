package common

import (
	"lunar/toolkit-core/configuration"
	"lunar/toolkit-core/urltree"
	"os"
	"time"

	"github.com/rs/zerolog/log"
)

const policiesConfigEnvVar = "LUNAR_PROXY_POLICIES_CONFIG"

type (
	EmptyStruct    = struct{}
	SimpleURLTree  = urltree.URLTree[EmptyStruct]
	SimpleURLTreeI = urltree.URLTreeI[EmptyStruct]
)

func BuildTree(endpoints KnownEndpoints) (*SimpleURLTree, error) {
	tree := urltree.NewURLTree[EmptyStruct]()
	emptyStruct := EmptyStruct{}
	for _, endpoint := range endpoints.Endpoints {
		err := tree.Insert(endpoint.URL, &emptyStruct)
		if err != nil {
			return nil, err
		}
	}
	return tree, nil
}

func GetPoliciesPath() (string, error) {
	path, pathErr := configuration.GetPathFromEnvVarOrDefault(
		policiesConfigEnvVar,
		"./policies.yaml",
	)
	if pathErr != nil {
		return "", pathErr
	}
	return path, nil
}

func ReadKnownEndpoints() (*KnownEndpoints, error) {
	path, pathErr := GetPoliciesPath()
	if pathErr != nil {
		return nil, pathErr
	}

	config, readErr := configuration.DecodeYAML[KnownEndpoints](path)
	if readErr != nil {
		return nil, readErr
	}

	log.Debug().Msg("Loaded endpoints tree")

	return config, nil
}

func GetPoliciesLastModifiedTime() (time.Time, error) {
	path, pathErr := GetPoliciesPath()
	if pathErr != nil {
		return time.Time{}, pathErr
	}

	info, err := os.Stat(path)
	if err != nil {
		log.Debug().Err(err).Msgf("Failed to get last modified time for %s", path)
		// If failed to get last modified time, set to the beginning of time
		return time.Time{}, nil
	}

	return info.ModTime(), nil
}
