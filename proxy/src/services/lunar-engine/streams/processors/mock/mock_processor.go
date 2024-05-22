package processormock

import (
	streamtypes "lunar/engine/streams/types"
)

type mockProcessor struct {
	name     string
	arg1     interface{}
	arg2     interface{}
	metaData *streamtypes.ProcessorMetaData
}

func NewProcessor(metaData *streamtypes.ProcessorMetaData) (streamtypes.Processor, error) {
	mockProc := &mockProcessor{
		name:     metaData.Name,
		metaData: metaData,
	}

	if val, ok := metaData.Parameters["arg1"]; ok {
		mockProc.arg1 = val.Value
	}

	if val, ok := metaData.Parameters["arg2"]; ok {
		mockProc.arg2 = val.Value
	}

	return mockProc, nil
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
