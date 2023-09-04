package configuration

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/rs/zerolog/log"
)

func GetPathFromEnvVarOrDefault(
	pathEnvVar, rawDefaultPath string,
) (string, error) {
	suppliedPath, validEnvVar := os.LookupEnv(pathEnvVar)
	if validEnvVar {
		return suppliedPath, nil
	}

	log.Warn().Msgf("Env var %v not set, will try default path", pathEnvVar)

	defaultPath, defaultPathErr := filepath.Abs(rawDefaultPath)
	if defaultPathErr != nil {
		return "", defaultPathErr
	}
	return defaultPath, nil
}

func shouldLoadTemplateFromEnv(policyValue string) bool {
	return strings.HasPrefix(policyValue, "${{") &&
		strings.HasSuffix(policyValue, "}}")
}

func processEnvTemplate(policyValue string) (string, error) {
	envVarName := strings.Trim(policyValue, "${}")
	envVarValue := os.Getenv(envVarName)

	if envVarValue == "" {
		return envVarName,
			fmt.Errorf("💔 Could not load the value of %v from ENV", envVarName)
	}
	return envVarValue, nil
}

func TryAndLoadEnvTemplateValue(envKey string) (string, error) {
	if shouldLoadTemplateFromEnv(envKey) {
		name, err := processEnvTemplate(envKey)
		if err != nil {
			return envKey, err
		}

		return name, nil
	}
	return envKey, nil
}
