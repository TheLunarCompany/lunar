package config

import (
	"lunar/toolkit-core/typing"

	"github.com/rs/zerolog/log"
)

// Getter for Remedy.Type which infers type automatically
// if underlying union type is defined correctly
func (remedy *Remedy) Type() RemedyType {
	err := typing.EnsureTag(
		&remedy.remedyType,
		RemedyUndefined,
		remedy.GetMapping,
	)
	if err != nil {
		log.Warn().Stack().Err(err).
			Msg("cannot ensure RemedyType, will return undefined type")
	}
	return remedy.remedyType
}

func (diagnosis *Diagnosis) Type() DiagnosisType {
	err := typing.EnsureTag(
		&diagnosis.diagnosisType,
		DiagnosisUndefined,
		diagnosis.GetMapping,
	)
	if err != nil {
		log.Warn().Stack().Err(err).
			Msg("cannot ensure DiagnosisType, will return undefined type")
	}
	return diagnosis.diagnosisType
}

// Needed to implement typing.Mappable
func (remedy *Remedy) GetMapping() []typing.UnionMemberPresence[RemedyType] {
	return []typing.UnionMemberPresence[RemedyType]{
		{
			Defined: remedy.Config.Caching != nil,
			Value:   RemedyCaching,
		},
		{
			Defined: remedy.Config.ResponseBasedThrottling != nil,
			Value:   RemedyResponseBasedThrottling,
		},
		{
			Defined: remedy.Config.StrategyBasedThrottling != nil,
			Value:   RemedyStrategyBasedThrottling,
		},
		{
			Defined: remedy.Config.ConcurrencyBasedThrottling != nil,
			Value:   RemedyConcurrencyBasedThrottling,
		},
		{
			Defined: remedy.Config.FixedResponse != nil,
			Value:   RemedyFixedResponse,
		},
		{
			Defined: remedy.Config.AccountOrchestration != nil,
			Value:   RemedyAccountOrchestration,
		},
		{
			Defined: remedy.Config.Retry != nil,
			Value:   RemedyRetry,
		},
	}
}

func (diagnosis *Diagnosis) GetMapping() []typing.UnionMemberPresence[DiagnosisType] { //nolint:lll
	return []typing.UnionMemberPresence[DiagnosisType]{
		{
			Defined: diagnosis.Config.HARExporter != nil,
			Value:   DiagnosisHARExporter,
		},
		{
			Defined: diagnosis.Config.MetricsCollector != nil,
			Value:   DiagnosisMetricsCollector,
		},
		{
			Defined: diagnosis.Config.Void != nil,
			Value:   DiagnosisVoid,
		},
	}
}
