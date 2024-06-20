package testprocessors

import (
	"fmt"
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

func (p *MockProcessorUsingContext) Execute(apiStream *streamtypes.APIStream) (streamtypes.ProcessorIO, error) { //nolint:lll
	if p.source {
		p.setData(apiStream)
	} else {
		if err := p.readData(apiStream); err != nil {
			return streamtypes.ProcessorIO{}, err
		}
	}

	return streamtypes.ProcessorIO{
		Type: streamtypes.StreamTypeAny,
		Name: "",
	}, nil
}

func (p *MockProcessorUsingContext) setData(apiStream *streamtypes.APIStream) {
	switch p.contextType {
	case FlowContext:
		apiStream.Context.GetFlowContext().Set(FlowKey, FlowValue) //nolint:errcheck
	case GlobalContext:
		return
	case TransactionalContext:
		apiStream.Context.GetTransactionalContext().Set(TransactionalKey, transactionalValue) //nolint:errcheck,lll
	}
}

func (p *MockProcessorUsingContext) readData(apiStream *streamtypes.APIStream) error {
	var ctx streamtypes.ContextI
	var expectedKey, expectedValue string
	switch p.contextType {
	case FlowContext:
		ctx = apiStream.Context.GetFlowContext()
		expectedKey = FlowKey
		expectedValue = FlowValue
	case GlobalContext:
		ctx = apiStream.Context.GetGlobalContext()
		expectedKey = GlobalKey
		expectedValue = GlobalValue
	case TransactionalContext:
		ctx = apiStream.Context.GetTransactionalContext()
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
		apiStream.Context.GetGlobalContext().Set(expectedKey, UsedValue) //nolint:errcheck
	}

	return nil
}

func (p *MockProcessorUsingContext) GetName() string {
	return p.Name
}
