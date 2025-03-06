package exporters_test

import (
	"bytes"
	"lunar/engine/services/diagnoses"
	"lunar/engine/services/exporters"
	sharedConfig "lunar/shared-model/config"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestWhenExportIsCalledWithFileExporterNameDataIsWrittenWithFileExporter(
	t *testing.T,
) {
	t.Parallel()
	exporterType := sharedConfig.ExporterFile
	wantData, event := testExporterType(t, exporterType)

	assert.Equal(t, 2, len(event))
	assert.Equal(t, []byte(exporterType.Name()), event[0])
	assert.Equal(t, *wantData.RawData, event[1])
}

func TestWhenExportIsCalledWithS3ExporterNameDataIsWrittenWithS3Exporter(
	t *testing.T,
) {
	t.Parallel()
	exporterType := sharedConfig.ExporterS3
	wantData, event := testExporterType(t, exporterType)

	assert.Equal(t, 2, len(event))
	assert.Equal(t, []byte(exporterType.Name()), event[0])
	assert.Equal(t, *wantData.RawData, event[1])
}

type mockWriter struct {
	content []byte
}

func (writer *mockWriter) Close() error {
	return nil
}

func (writer *mockWriter) Write(b []byte) (int, error) {
	if len(writer.content) > 0 {
		writer.content = append(writer.content, '\n')
	}
	writer.content = append(writer.content, b...)
	return len(b), nil
}

func testExporterType(
	t *testing.T,
	exporterType sharedConfig.ExporterType,
) (diagnoses.DiagnosisOutput, [][]byte) {
	mockWriter := &mockWriter{}
	exporter := exporters.NewRawDataExporter(mockWriter)
	b := []byte("test")
	wantData := diagnoses.DiagnosisOutput{RawData: &b}

	err := exporter.Export(wantData, exporterType)
	assert.Nil(t, err)

	var space byte = ' '
	event := bytes.Split(mockWriter.content, []byte{space})
	return wantData, event
}
