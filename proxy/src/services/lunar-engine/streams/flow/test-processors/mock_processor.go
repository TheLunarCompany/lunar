package testprocessors

import (
	streamtypes "lunar/engine/streams/types"
)

func NewMockProcessor(metadata *streamtypes.ProcessorMetaData) (streamtypes.Processor, error) {
	return &MockProcessor{Name: metadata.Name, Metadata: metadata}, nil
}

type MockProcessor struct {
	Name     string
	Metadata *streamtypes.ProcessorMetaData
}

func (p *MockProcessor) Execute(_ *streamtypes.APIStream) (streamtypes.ProcessorIO, error) {
	return streamtypes.ProcessorIO{
		Type: streamtypes.StreamTypeAny,
		Name: "",
	}, nil
}

func (p *MockProcessor) GetName() string {
	return p.Name
}
