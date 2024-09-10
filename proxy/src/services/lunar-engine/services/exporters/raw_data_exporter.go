package exporters

import (
	"fmt"
	"lunar/engine/services/diagnoses"
	"lunar/engine/utils/writers"
	sharedConfig "lunar/shared-model/config"

	"github.com/rs/zerolog/log"
)

type RawDataExporter struct {
	writer     writers.Writer
	retryCount int
}

func NewRawDataExporter(writer writers.Writer) *RawDataExporter {
	return &RawDataExporter{
		writer:     writer,
		retryCount: 3,
	}
}

func (exporter *RawDataExporter) Export(
	diagnosisOutput diagnoses.DiagnosisOutput,
	exporterType sharedConfig.ExporterType,
) error {
	exporterName := exporterType.Name()
	if exporterName == sharedConfig.ExporterNameUndefined {
		log.Error().Msgf("Failed to export, exporter type %v is not defined",
			exporterType)
		return nil
	}
	content := diagnosisOutput.RawData
	if content == nil {
		return fmt.Errorf("Content is undefined, cannot export")
	}

	message := message{
		content:      *content,
		exporterName: []byte(exporterName),
	}
	err := exporter.writeMessage(message)
	if err != nil {
		log.Error().Err(err).
			Msgf("Failed to export to %s", exporterName)
		return err
	}

	log.Debug().Msgf("💿 Exported to %s", exporterName)
	return nil
}

type message struct {
	content      []byte
	exporterName []byte
}

func (exporter *RawDataExporter) writeMessage(message message) error {
	var space byte = ' '
	var messageBytes []byte
	messageBytes = append(messageBytes, message.exporterName...)
	messageBytes = append(messageBytes, space)
	messageBytes = append(messageBytes, message.content...)
	return exporter.writeMessageWithRetry(messageBytes)
}

func (exporter *RawDataExporter) writeMessageWithRetry(
	content []byte,
) error {
	var err error
	for attempt := 0; attempt < exporter.retryCount; attempt++ {
		err = exporter.writeBytes(content)
		if err == nil {
			return nil
		}
		log.Debug().Err(err).Msgf("Failed to write message, retrying (%d/%d)",
			attempt+1, exporter.retryCount)
	}
	return err
}

func (exporter *RawDataExporter) writeBytes(content []byte) error {
	_, err := exporter.writer.Write(content)
	return err
}
