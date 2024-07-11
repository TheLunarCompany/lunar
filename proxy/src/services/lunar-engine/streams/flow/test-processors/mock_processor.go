package testprocessors

import (
	streamtypes "lunar/engine/streams/types"
)

const GlobalKeyExecutionOrder = "exec_order"

func NewMockProcessor(metadata *streamtypes.ProcessorMetaData) (streamtypes.Processor, error) {
	return &MockProcessor{Name: metadata.Name, Metadata: metadata}, nil
}

type MockProcessor struct {
	Name     string
	Metadata *streamtypes.ProcessorMetaData
}

func (p *MockProcessor) Execute(apiStream *streamtypes.APIStream) (streamtypes.ProcessorIO, error) {
	signInExecution(apiStream, p.Name)

	return streamtypes.ProcessorIO{
		Type: streamtypes.StreamTypeAny,
		Name: "",
	}, nil
}

func (p *MockProcessor) GetName() string {
	return p.Name
}

func signInExecution(apiStream *streamtypes.APIStream, name string) {
	var execOrder []string
	if val, err := apiStream.Context.GetGlobalContext().Get(GlobalKeyExecutionOrder); err == nil {
		execOrder = val.([]string)
	}
	execOrder = append(execOrder, name)
	apiStream.Context.GetGlobalContext().Set(GlobalKeyExecutionOrder, execOrder) //nolint:errcheck
}
