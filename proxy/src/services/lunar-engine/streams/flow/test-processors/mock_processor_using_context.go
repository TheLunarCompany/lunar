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

func NewMockProcessorUsingGlobalContextSrc(metadata *streamtypes.ProcessorMetaData) (streamtypes.Processor, error) { //nolint:lll
	return &MockProcessorUsingContext{Name: metadata.Name, Metadata: metadata, contextType: GlobalContext, source: true}, nil //nolint:lll
}

func NewMockProcessorUsingGlobalContextDest(metadata *streamtypes.ProcessorMetaData) (streamtypes.Processor, error) { //nolint:lll
	return &MockProcessorUsingContext{Name: metadata.Name, Metadata: metadata, contextType: GlobalContext}, nil //nolint:lll
}

func NewMockProcessorUsingFlowContextSrc(metadata *streamtypes.ProcessorMetaData) (streamtypes.Processor, error) { //nolint:lll
	return &MockProcessorUsingContext{Name: metadata.Name, Metadata: metadata, contextType: FlowContext, source: true}, nil //nolint:lll
}

func NewMockProcessorUsingFlowContextDest(metadata *streamtypes.ProcessorMetaData) (streamtypes.Processor, error) { //nolint:lll
	return &MockProcessorUsingContext{Name: metadata.Name, Metadata: metadata, contextType: FlowContext}, nil //nolint:lll
}

func NewMockProcessorUsingTrContextSrc(metadata *streamtypes.ProcessorMetaData) (streamtypes.Processor, error) { //nolint:lll
	return &MockProcessorUsingContext{Name: metadata.Name, Metadata: metadata, contextType: TransactionalContext, source: true}, nil //nolint:lll
}

func NewMockProcessorUsingTrContextDest(metadata *streamtypes.ProcessorMetaData) (streamtypes.Processor, error) { //nolint:lll
	return &MockProcessorUsingContext{Name: metadata.Name, Metadata: metadata, contextType: TransactionalContext}, nil //nolint:lll
}

type MockProcessorUsingContext struct {
	Name     string
	Metadata *streamtypes.ProcessorMetaData

	contextType contextType
	source      bool
}

func (p *MockProcessorUsingContext) Execute(apiStream publictypes.APIStreamI) (streamtypes.ProcessorIO, error) { //nolint:lll
	signInExecution(apiStream, p.Name)
	if p.source {
		p.setData(apiStream)
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

func (p *MockProcessorUsingContext) setData(apiStream publictypes.APIStreamI) {
	switch p.contextType {
	case FlowContext:
		apiStream.GetContext().GetFlowContext().Set(FlowKey, FlowValue) //nolint:errcheck
	case GlobalContext:
		return
	case TransactionalContext:
		apiStream.GetContext().GetTransactionalContext().Set(TransactionalKey, transactionalValue) //nolint:errcheck,lll
	}
}

func (p *MockProcessorUsingContext) readData(apiStream publictypes.APIStreamI) error {
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
	val, err := ctx.Get(expectedKey)
	if err != nil {
		return err
	}
	if val != expectedValue {
		return fmt.Errorf("value mismatch")
	}

	ctx.Set(expectedKey, UsedValue) //nolint:errcheck
	if p.contextType == TransactionalContext {
		apiStream.GetContext().GetGlobalContext().Set(expectedKey, UsedValue) //nolint:errcheck
	}

	return nil
}

func (p *MockProcessorUsingContext) GetName() string {
	return p.Name
}
