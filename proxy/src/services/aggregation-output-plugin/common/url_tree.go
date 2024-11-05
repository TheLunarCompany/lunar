package common

import (
	sharedDiscovery "lunar/shared-model/discovery"
	"lunar/toolkit-core/configuration"
	"lunar/toolkit-core/urltree"
	"os"
	"time"

	"github.com/rs/zerolog/log"
)

const (
	policiesConfigEnvVar       = "LUNAR_PROXY_POLICIES_CONFIG"
	flowsPathParamConfigEnvVar = "LUNAR_FLOWS_PATH_PARAM_CONFIG"
	idleWaitForFileCreation    = 250 * time.Millisecond
	fileCreationTryAttempts    = 10
)

type (
	EmptyStruct    = struct{}
	SimpleURLTree  = urltree.URLTree[EmptyStruct]
	SimpleURLTreeI = urltree.URLTreeI[EmptyStruct]
)

func NormalizeTree(
	tree SimpleURLTreeI,
	urls []string,
) (bool, error) {
	// Requests URLs are inserted into the tree in order to effectively
	// normalize it by using this tree's assumed path params feature which
	// is turned on on this instance upon initialization.
	// If convergence has occurred, this will be signaled by the return value.
	convergenceOccurred := false
	for _, url := range urls {
		update, err := tree.InsertWithConvergenceIndication(url, &EmptyStruct{})
		if err != nil {
			log.Error().
				Err(err).
				Msgf("Error updating tree with URL: %v", url)
			return false, err
		}
		if !convergenceOccurred && update {
			convergenceOccurred = update
		}
	}

	return convergenceOccurred, nil
}

func BuildTree(
	endpoints sharedDiscovery.KnownEndpoints,
	maxSplitThreshold int,
) (*SimpleURLTree, error) {
	tree := urltree.NewURLTree[EmptyStruct](true, maxSplitThreshold)
	emptyStruct := EmptyStruct{}
	for _, endpoint := range endpoints.Endpoints {
		err := tree.InsertDeclaredURL(endpoint.URL, &emptyStruct)
		if err != nil {
			return nil, err
		}
	}
	return tree, nil
}

func GetPoliciesPath() (string, error) {
	pathParamConfig := flowsPathParamConfigEnvVar
	if !IsFlowsEnabled() {
		pathParamConfig = policiesConfigEnvVar
	}

	path, pathErr := configuration.GetPathFromEnvVarOrDefault(
		pathParamConfig,
		"./policies.yaml",
	)
	if pathErr != nil {
		return "", pathErr
	}
	return path, nil
}

func ReadKnownEndpoints() (*sharedDiscovery.KnownEndpoints, error) {
	path, pathErr := GetPoliciesPath()
	if pathErr != nil {
		return nil, pathErr
	}
	waitForFileCreation(path)
	config, readErr := configuration.DecodeYAML[sharedDiscovery.KnownEndpoints](path)
	if readErr != nil {
		return nil, readErr
	}

	log.Debug().Msg("Loaded endpoints tree")

	return config.UnmarshaledData, nil
}

func GetPoliciesLastModifiedTime() (time.Time, error) {
	path, pathErr := GetPoliciesPath()
	if pathErr != nil {
		return time.Time{}, pathErr
	}
	waitForFileCreation(path)

	info, err := os.Stat(path)
	if err != nil {
		log.Debug().
			Err(err).
			Msgf("Failed to get last modified time for %s", path)
		// If failed to get last modified time, set to the beginning of time
		return time.Time{}, nil
	}

	return info.ModTime(), nil
}

// This function waits for the file to be created.
func waitForFileCreation(path string) {
	var err error
	_, err = os.Stat(path)
	if err == nil {
		return
	}

	ticker := time.NewTicker(idleWaitForFileCreation)
	for i := 0; i < fileCreationTryAttempts; i++ {
		<-ticker.C
		_, err = os.Stat(path)
		if err == nil {
			return
		}
	}

	log.Debug().Msgf("File %s was not created", path)
}

func IsFlowsEnabled() bool {
	return os.Getenv("LUNAR_STREAMS_ENABLED") == "true"
}
