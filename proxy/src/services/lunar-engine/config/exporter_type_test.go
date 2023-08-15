package config_test

import (
	sharedConfig "lunar/shared-model/config"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestWhenExporterTypeIsCalledWithExportFileThenExporterFileIsReturned(
	t *testing.T,
) {
	diagnosis := sharedConfig.Diagnosis{
		Enabled: true,
		Name:    "diagnosis",
		Config: sharedConfig.DiagnosisConfig{
			HARExporter: &sharedConfig.HARExporterConfig{
				TransactionMaxSize: 100,
			},
		},
		Export: "file",
	}

	exporterType := diagnosis.ExporterType()

	assert.Equal(t, sharedConfig.ExporterFile, exporterType)
}

func TestWhenExporterTypeIsCalledWithExportFileWrittenInMixedCaseThenExporterFileIsReturned( //nolint:lll
	t *testing.T,
) {
	diagnosis := sharedConfig.Diagnosis{
		Enabled: true,
		Name:    "diagnosis",
		Config: sharedConfig.DiagnosisConfig{
			HARExporter: &sharedConfig.HARExporterConfig{
				TransactionMaxSize: 100,
			},
		},
		Export: "FiLe",
	}

	exporterType := diagnosis.ExporterType()

	assert.Equal(t, sharedConfig.ExporterFile, exporterType)
}

func TestWhenExporterTypeIsCalledWithExportS3ThenExporterS3IsReturned(
	t *testing.T,
) {
	diagnosis := sharedConfig.Diagnosis{
		Enabled: true,
		Name:    "diagnosis",
		Config: sharedConfig.DiagnosisConfig{
			HARExporter: &sharedConfig.HARExporterConfig{
				TransactionMaxSize: 100,
			},
		},
		Export: "s3",
	}

	exporterType := diagnosis.ExporterType()

	assert.Equal(t, sharedConfig.ExporterS3, exporterType)
}

func TestWhenExporterTypeIsCalledWithNoExportDefinedThenExporterUndefinedIsReturned( //nolint:lll
	t *testing.T,
) {
	diagnosis := sharedConfig.Diagnosis{
		Enabled: true,
		Name:    "diagnosis",
		Config: sharedConfig.DiagnosisConfig{
			HARExporter: &sharedConfig.HARExporterConfig{
				TransactionMaxSize: 100,
			},
		},
	}

	exporterType := diagnosis.ExporterType()

	assert.Equal(t, sharedConfig.ExporterUndefined, exporterType)
}

func TestWhenExporterTypeIsCalledWithUnknownExportThenExporterUndefinedIsReturned( //nolint:lll
	t *testing.T,
) {
	diagnosis := sharedConfig.Diagnosis{
		Enabled: true,
		Name:    "diagnosis",
		Config: sharedConfig.DiagnosisConfig{
			HARExporter: &sharedConfig.HARExporterConfig{
				TransactionMaxSize: 100,
			},
		},
		Export: "unknown",
	}

	exporterType := diagnosis.ExporterType()

	assert.Equal(t, sharedConfig.ExporterUndefined, exporterType)
}
