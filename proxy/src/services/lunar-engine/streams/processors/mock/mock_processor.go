package processormock

import (
	"fmt"
	streamconfig "lunar/engine/streams/config"
	streamtypes "lunar/engine/streams/types"
)

type mockProcessor struct {
	name     string
	arg1     interface{}
	arg2     interface{}
	metaData *streamtypes.ProcessorMetaData
}

func NewProcessorFromConfig(confProc streamconfig.Processor) (streamtypes.Processor, error) {
	params := make(map[string]streamtypes.ProcessorParam)
	for i, param := range confProc.Parameters {
		params[fmt.Sprintf("arg%v", i+1)] = streamtypes.ProcessorParam{
			Name:  param.Key,
			Value: param.Value,
		}
	}

	return NewProcessor(&streamtypes.ProcessorMetaData{
		Name:       confProc.Processor,
		Parameters: params,
	}), nil
}

func NewProcessor(metaData *streamtypes.ProcessorMetaData) streamtypes.Processor {
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

	return mockProc
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
