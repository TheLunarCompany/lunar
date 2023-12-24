package config

import (
	"fmt"
	"lunar/toolkit-core/configuration"
	"strings"
)

// Exporters
func (exporters *Exporters) Equal(otherExporters Exporters) bool {
	return nilOrEqual(exporters.File, otherExporters.File) &&
		nilOrEqual(exporters.S3, otherExporters.S3) &&
		nilOrEqual(exporters.S3Minio, otherExporters.S3Minio)
}

func nilOrEqual[T comparable](a, b *T) bool { //nolint:varnamelen
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

// RemedyType
func (remedyType RemedyType) String() string {
	var result string
	switch remedyType {
	case RemedyCaching:
		result = "caching"
	case RemedyResponseBasedThrottling:
		result = "response_based_throttling"
	case RemedyStrategyBasedThrottling:
		result = "strategy_based_throttling"
	case RemedyConcurrencyBasedThrottling:
		result = "concurrency_based_throttling"
	case RemedyStrategyBasedQueue:
		result = "strategy_based_queue"
	case RemedyAccountOrchestration:
		result = "account_orchestration"
	case RemedyFixedResponse:
		result = "fixed_response"
	case RemedyRetry:
		result = "retry"
	case RemedyAuth:
		result = "authentication"
	case RemedyUndefined:
		result = "undefined"
	}

	return result
}

func ParseRemedyType(raw string) (RemedyType, error) {
	var res RemedyType
	raw = strings.TrimSpace(raw)
	switch raw {
	case RemedyUndefined.String():
		res = RemedyUndefined
	case RemedyCaching.String():
		res = RemedyCaching
	case RemedyResponseBasedThrottling.String():
		res = RemedyResponseBasedThrottling
	case RemedyStrategyBasedThrottling.String():
		res = RemedyStrategyBasedThrottling
	case RemedyStrategyBasedQueue.String():
		res = RemedyStrategyBasedQueue
	case RemedyConcurrencyBasedThrottling.String():
		res = RemedyConcurrencyBasedThrottling
	case RemedyAccountOrchestration.String():
		res = RemedyAccountOrchestration
	case RemedyFixedResponse.String():
		res = RemedyFixedResponse
	case RemedyRetry.String():
		res = RemedyRetry
	case RemedyAuth.String():
		res = RemedyAuth
	default:
		return RemedyUndefined, fmt.Errorf(
			"RemedyType %v is not recognized",
			raw,
		)
	}
	return res, nil
}

func (auth *Authentication) LoadEnvValues() error {
	if auth.APIKey != nil {
		for _, token := range auth.APIKey.Tokens {
			err := token.LoadEnvValues()
			if err != nil {
				return err
			}
		}
	}
	if auth.OAuth != nil {
		for _, token := range auth.OAuth.Tokens {
			err := token.LoadEnvValues()
			if err != nil {
				return err
			}
		}
	}
	if auth.Basic != nil {
		err := auth.Basic.LoadEnvValues()
		if err != nil {
			return err
		}
	}
	return nil
}

func (auth *Body) LoadEnvValues() error {
	var err error
	auth.Name, err = configuration.TryAndLoadEnvTemplateValue(auth.Name)

	if err != nil {
		return err
	}

	auth.Value, err = configuration.TryAndLoadEnvTemplateValue(auth.Value)

	if err != nil {
		return err
	}
	return nil
}

func (auth *Header) LoadEnvValues() error {
	var err error
	auth.Name, err = configuration.TryAndLoadEnvTemplateValue(auth.Name)

	if err != nil {
		return err
	}

	auth.Value, err = configuration.TryAndLoadEnvTemplateValue(auth.Value)

	if err != nil {
		return err
	}
	return nil
}

func (auth *BasicAuth) LoadEnvValues() error {
	var err error
	auth.Username, err = configuration.TryAndLoadEnvTemplateValue(auth.Username)

	if err != nil {
		return err
	}

	auth.Password, err = configuration.TryAndLoadEnvTemplateValue(auth.Password)

	if err != nil {
		return err
	}
	return nil
}
