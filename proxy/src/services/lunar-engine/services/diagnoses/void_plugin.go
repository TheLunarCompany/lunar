package diagnoses

import (
	"fmt"
	"lunar/engine/config"
	lunarMessages "lunar/engine/messages"
	sharedConfig "lunar/shared-model/config"
)

// This diagnosis plugin is the simplest possible plugin - it does nothing.
// It is useful for testing and benchmarking scenarios, mainly.

type VoidPlugin struct{}

func (plugin *VoidPlugin) OnTransaction(
	_ lunarMessages.OnRequest,
	_ lunarMessages.OnResponse,
	_ *config.EndpointPolicyTree,
	scopedDiagnosis *config.ScopedDiagnosis,
) (*DiagnosisOutput, error) {
	diagnosisOutput := DiagnosisOutput{} //nolint:exhaustruct
	switch scopedDiagnosis.Diagnosis.ExporterKind() {
	case sharedConfig.ExporterKindMetrics:
		diagnosisOutput.Metrics = &MetricsCollectorRecord{} //nolint:exhaustruct
	case sharedConfig.ExporterKindRawData:
		data := []byte{}
		diagnosisOutput.RawData = &data
	case sharedConfig.ExporterKindUndefined:
		return nil, fmt.Errorf("exporter kind undefined")
	}

	return &diagnosisOutput, nil
}
