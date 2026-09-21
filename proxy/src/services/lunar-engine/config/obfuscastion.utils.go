package config

import (
	sharedConfig "lunar/shared-model/config"
	"strings"

	"golang.org/x/exp/slices"
)

func ShouldObfuscateRequestHeader(
	config sharedConfig.Obfuscate,
) func(string) bool {
	return func(header string) bool {
		return config.Enabled &&
			shouldObfuscate(header, config.Exclusions.RequestHeaders)
	}
}

func ShouldObfuscateResponseHeader(
	config sharedConfig.Obfuscate,
) func(string) bool {
	return func(header string) bool {
		return config.Enabled &&
			shouldObfuscate(header, config.Exclusions.ResponseHeaders)
	}
}

func ShouldObfuscateQueryParam(
	config sharedConfig.Obfuscate,
) func(string) bool {
	return func(paramName string) bool {
		return config.Enabled &&
			shouldObfuscate(paramName, config.Exclusions.QueryParams)
	}
}

func ShouldObfuscatePathParam(
	config sharedConfig.Obfuscate,
) func(string) bool {
	return func(paramName string) bool {
		return config.Enabled &&
			shouldObfuscate(paramName, config.Exclusions.PathParams)
	}
}

func shouldObfuscate(value string, exclusionList []string) bool {
	return !slices.Contains(exclusionList, strings.TrimSpace(value))
}
