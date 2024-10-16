package testprocessors

import (
	"fmt"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
)

type contextType int

const (
	TransactionalKey   = "tr_key"
	transactionalValue = "tr_value"

	GlobalKey   = "global"
	GlobalValue = "global value"

	FlowKey   = "flow"
	FlowValue = "flow value"

	UsedValue = "used"

	FlowContext contextType = iota
	GlobalContext
	TransactionalContext
)

func NewMockProcessorUsingGlobalContextSrc(
	metadata *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	return &MockProcessorUsingContext{
		Name:        metadata.Name,
		Metadata:    metadata,
		contextType: GlobalContext,
		source:      true,
	}, nil
}

func NewMockProcessorUsingGlobalContextDest(
	metadata *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	return &MockProcessorUsingContext{
		Name:        metadata.Name,
		Metadata:    metadata,
		contextType: GlobalContext,
	}, nil
}

func NewMockProcessorUsingFlowContextSrc(
	metadata *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	return &MockProcessorUsingContext{
		Name:        metadata.Name,
		Metadata:    metadata,
		contextType: FlowContext,
		source:      true,
	}, nil
}

func NewMockProcessorUsingFlowContextDest(
	metadata *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	return &MockProcessorUsingContext{
		Name:        metadata.Name,
		Metadata:    metadata,
		contextType: FlowContext,
	}, nil
}

func NewMockProcessorUsingTrContextSrc(
	metadata *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	return &MockProcessorUsingContext{
		Name:        metadata.Name,
		Metadata:    metadata,
		contextType: TransactionalContext,
		source:      true,
	}, nil
}

func NewMockProcessorUsingTrContextDest(
	metadata *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	return &MockProcessorUsingContext{
		Name:        metadata.Name,
		Metadata:    metadata,
		contextType: TransactionalContext,
	}, nil
}

type MockProcessorUsingContext struct {
	Name     string
	Metadata *streamtypes.ProcessorMetaData

	contextType contextType
	source      bool
}

func (p *MockProcessorUsingContext) Execute(
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	err := signInExecution(apiStream, p.Name)
	if err != nil {
		return streamtypes.ProcessorIO{}, err
	}

	if p.source {
		err := p.setData(apiStream)
		if err != nil {
			return streamtypes.ProcessorIO{}, err
		}
	} else {
		if err := p.readData(apiStream); err != nil {
			return streamtypes.ProcessorIO{}, err
		}
	}

	return streamtypes.ProcessorIO{
		Type: publictypes.StreamTypeAny,
		Name: "",
	}, nil
}

func (p *MockProcessorUsingContext) setData(
	apiStream publictypes.APIStreamI,
) error {
	switch p.contextType {
	case FlowContext:
		return apiStream.GetContext().
			GetFlowContext().
			Set(FlowKey, FlowValue)

	case GlobalContext:
		return nil

	case TransactionalContext:
		return apiStream.GetContext().
			GetTransactionalContext().
			Set(TransactionalKey, transactionalValue)
	}
	return fmt.Errorf("unknown context type: %d", p.contextType)
}

func (p *MockProcessorUsingContext) readData(
	apiStream publictypes.APIStreamI,
) error {
	var ctx publictypes.ContextI
	var expectedKey, expectedValue string
	switch p.contextType {
	case FlowContext:
		ctx = apiStream.GetContext().GetFlowContext()
		expectedKey = FlowKey
		expectedValue = FlowValue
	case GlobalContext:
		ctx = apiStream.GetContext().GetGlobalContext()
		expectedKey = GlobalKey
		expectedValue = GlobalValue
	case TransactionalContext:
		ctx = apiStream.GetContext().GetTransactionalContext()
		expectedKey = TransactionalKey
		expectedValue = transactionalValue
	}
	outVal, err := ctx.Get(expectedKey)
	if err != nil {
		return err
	}
	if outVal != expectedValue {
		return fmt.Errorf(
			"value mismatch, with key: %s, wanted: %s, got: %s",
			expectedKey,
			expectedValue,
			outVal,
		)
	}

	err = ctx.Set(expectedKey, UsedValue)
	if err != nil {
		return err
	}

	if p.contextType == TransactionalContext {
		return apiStream.GetContext().
			GetGlobalContext().
			Set(expectedKey, UsedValue)
	}

	return nil
}

func (p *MockProcessorUsingContext) GetName() string {
	return p.Name
}
