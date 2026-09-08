package config

type ExporterKind int

const (
	ExporterKindUndefined ExporterKind = iota
	ExporterKindRawData
	ExporterKindMetrics
)

func (diagnosis *Diagnosis) ExporterKind() ExporterKind {
	var exporterKind ExporterKind
	switch diagnosis.ExporterType() {
	case ExporterS3, ExporterS3Minio, ExporterFile:
		exporterKind = ExporterKindRawData
	case ExporterPrometheus:
		exporterKind = ExporterKindMetrics
	case ExporterUndefined:
		exporterKind = ExporterKindUndefined
	}

	return exporterKind
}
