package processormock

import (
	streamtypes "lunar/engine/streams/types"
)

type mockProcessor struct {
	name     string
	arg1     int
	arg2     string
	metaData *streamtypes.ProcessorMetaData
}

func NewProcessor(metaData *streamtypes.ProcessorMetaData) streamtypes.Processor {
	return &mockProcessor{
		name:     metaData.Name,
		arg1:     metaData.Parameters["arg1"].Value.(int),
		arg2:     metaData.Parameters["arg2"].Value.(string),
		metaData: metaData,
	}
}

func (p *mockProcessor) Execute(_ *streamtypes.APIStream) (streamtypes.ProcessorIO, error) {
	return streamtypes.ProcessorIO{
		Type: streamtypes.StreamTypeAny,
		Name: "",
	}, nil
}

func (p *mockProcessor) GetName() string {
	return p.name
}
