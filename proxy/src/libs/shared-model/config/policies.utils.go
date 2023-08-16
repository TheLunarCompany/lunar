package config

import (
	"fmt"
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
	case RemedyAccountOrchestration:
		result = "account_orchestration"
	case RemedyFixedResponse:
		result = "fixed_response"
	case RemedyRetry:
		result = "retry"
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
	case RemedyConcurrencyBasedThrottling.String():
		res = RemedyConcurrencyBasedThrottling
	case RemedyAccountOrchestration.String():
		res = RemedyAccountOrchestration
	case RemedyFixedResponse.String():
		res = RemedyFixedResponse
	case RemedyRetry.String():
		res = RemedyRetry
	default:
		return RemedyUndefined, fmt.Errorf(
			"RemedyType %v is not recognized",
			raw,
		)
	}
	return res, nil
}
