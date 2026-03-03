package config_test

import (
	sharedConfig "lunar/shared-model/config"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExportersEqual(t *testing.T) {
	exporters := sharedConfig.Exporters{
		File: &sharedConfig.FileExporterConfig{FileDir: "foo", FileName: "bar"},
		S3: &sharedConfig.S3ExporterConfig{
			BucketName: "bar",
			Region:     "us-east-1",
		},
	}
	otherExporters := sharedConfig.Exporters{
		File: &sharedConfig.FileExporterConfig{FileDir: "foo", FileName: "bar"},
		S3: &sharedConfig.S3ExporterConfig{
			BucketName: "bar",
			Region:     "us-east-1",
		},
	}

	assert.True(t, exporters.Equal(otherExporters))
}

func TestExportersEqualWhenBothAreNil(t *testing.T) {
	var exporters, otherExporters sharedConfig.Exporters

	assert.True(t, exporters.Equal(otherExporters))
}

func TestExportersNotEqualWhenExporterIsMissing(t *testing.T) {
	exporters := sharedConfig.Exporters{
		File: &sharedConfig.FileExporterConfig{FileDir: "foo", FileName: "bar"},
		S3: &sharedConfig.S3ExporterConfig{
			BucketName: "bar",
			Region:     "us-east-1",
		},
	}
	otherExporters := sharedConfig.Exporters{
		File: &sharedConfig.FileExporterConfig{FileDir: "foo", FileName: "bar"},
	}

	assert.False(t, exporters.Equal(otherExporters))
}

func TestExportersNotEqualWhenExporterIsDifferent(t *testing.T) {
	exporters := sharedConfig.Exporters{
		File: &sharedConfig.FileExporterConfig{FileDir: "foo", FileName: "bar"},
		S3: &sharedConfig.S3ExporterConfig{
			BucketName: "bar",
			Region:     "us-east-1",
		},
	}
	otherExporters := sharedConfig.Exporters{
		File: &sharedConfig.FileExporterConfig{FileDir: "foo", FileName: "bar"},
		S3: &sharedConfig.S3ExporterConfig{
			BucketName: "bar",
			Region:     "us-east-2",
		},
	}

	assert.False(t, exporters.Equal(otherExporters))
}
