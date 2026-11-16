package config

import (
	"strings"

	"github.com/rs/zerolog/log"
)

func (diagnosis *Diagnosis) ExporterType() ExporterType {
	if diagnosis.exporterType != ExporterUndefined {
		return diagnosis.exporterType
	}

	exporterLiteral := strings.ToLower(strings.Trim(diagnosis.Export, " "))

	switch exporterLiteral {

	case ExporterS3.Name():
		diagnosis.exporterType = ExporterS3

	case ExporterFile.Name():
		diagnosis.exporterType = ExporterFile

	case ExporterS3Minio.Name():
		diagnosis.exporterType = ExporterS3Minio

	case ExporterPrometheus.Name():
		diagnosis.exporterType = ExporterPrometheus

	case "":
		log.Error().Msgf("Exporter type is not defined for diagnosis: %v",
			diagnosis.Name)
		diagnosis.exporterType = ExporterUndefined

	default:
		log.Error().Msgf("Unknown exporter type: %v for diagnosis: %v",
			diagnosis.Export, diagnosis.Name)
		diagnosis.exporterType = ExporterUndefined
	}

	return diagnosis.exporterType
}
