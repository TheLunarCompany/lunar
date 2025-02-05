package configuration

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/rs/zerolog/log"
)

func GetIntEnvValueOrDefault(envKey string, defaultValue int) (int, error) {
	valueStr := os.Getenv(envKey)
	if valueStr == "" {
		return defaultValue,
			fmt.Errorf("ENV var %s not set, will use default value %d", envKey, defaultValue)
	}

	value, err := strconv.Atoi(valueStr)
	if err != nil {
		return defaultValue, fmt.Errorf("failed to convert %s to int", valueStr)
	}
	return value, nil
}

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
