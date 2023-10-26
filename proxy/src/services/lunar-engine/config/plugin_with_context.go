package config

import (
	"lunar/engine/utils"
	sharedConfig "lunar/shared-model/config"
)

type ScopedRemedy struct {
	Scope         utils.Scope
	Method        string
	NormalizedURL string
	Remedy        *sharedConfig.Remedy
}

type ScopedDiagnosis struct {
	Scope         utils.Scope
	Method        string
	NormalizedURL string
	Diagnosis     *sharedConfig.Diagnosis
}
