package testprocessors

import (
	"lunar/engine/actions"
	streamtypes "lunar/engine/streams/types"
	"net/http"
)

type mockGenerateResponseProcessor struct {
	name       string
	statusCode int
	body       string
	header     map[string]string
	metaData   *streamtypes.ProcessorMetaData
}

func NewMockGenerateResponseProcessor(metadata *streamtypes.ProcessorMetaData) (streamtypes.Processor, error) { //nolint:lll
	return &mockGenerateResponseProcessor{name: metadata.Name, metaData: metadata, statusCode: http.StatusOK}, nil //nolint:lll
}

func NewMockGenerateResponse403Processor(metadata *streamtypes.ProcessorMetaData) (streamtypes.Processor, error) { //nolint:lll
	return &mockGenerateResponseProcessor{name: metadata.Name, metaData: metadata, statusCode: http.StatusForbidden}, nil //nolint:lll
}

func (p *mockGenerateResponseProcessor) GetName() string {
	return p.name
}

func (p *mockGenerateResponseProcessor) Execute(
	apiStream *streamtypes.APIStream,
) (streamtypes.ProcessorIO, error) {
	signInExecution(apiStream, p.name)
	var action actions.ReqLunarAction = &actions.NoOpAction{}
	if apiStream.Type == streamtypes.StreamTypeRequest {
		action = &actions.EarlyResponseAction{
			Status:  p.statusCode,
			Body:    p.body,
			Headers: p.header,
		}
	}

	return streamtypes.ProcessorIO{
		Type:      streamtypes.StreamTypeResponse,
		ReqAction: action,
		Name:      "",
	}, nil
}
