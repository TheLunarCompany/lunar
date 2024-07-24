package testprocessors

import (
	publictypes "lunar/engine/streams/public-types"
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

func (p *MockProcessor) Execute(apiStream publictypes.APIStreamI) (streamtypes.ProcessorIO, error) {
	signInExecution(apiStream, p.Name)

	return streamtypes.ProcessorIO{
		Type: publictypes.StreamTypeAny,
		Name: "",
	}, nil
}

func (p *MockProcessor) GetName() string {
	return p.Name
}

func signInExecution(apiStream publictypes.APIStreamI, name string) {
	var execOrder []string
	if val, err := apiStream.GetContext().GetGlobalContext().Get(GlobalKeyExecutionOrder); err == nil {
		execOrder = val.([]string)
	}
	execOrder = append(execOrder, name)
	apiStream.GetContext().GetGlobalContext().Set(GlobalKeyExecutionOrder, execOrder) //nolint:errcheck
}
