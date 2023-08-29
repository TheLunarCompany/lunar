package configuration

import (
	"os"
	"path/filepath"

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
