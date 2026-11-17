package processorretry

import (
	streamtypes "lunar/engine/streams/types"
)

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	return newProcessor(metaData)
}
