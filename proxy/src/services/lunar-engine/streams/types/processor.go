package streamtypes

type Processor interface {
	GetName() string
	Execute(*APIStream) error
}

type ProcessorMetaData struct{}
