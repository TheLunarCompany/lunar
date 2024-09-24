package testprocessors

import (
	"lunar/engine/actions"
	publictypes "lunar/engine/streams/public-types"
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
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	err := signInExecution(apiStream, p.name)
	if err != nil {
		return streamtypes.ProcessorIO{}, err
	}

	var action actions.ReqLunarAction = &actions.NoOpAction{}
	if apiStream.GetType() == publictypes.StreamTypeRequest {
		action = &actions.EarlyResponseAction{
			Status:  p.statusCode,
			Body:    p.body,
			Headers: p.header,
		}
	}

	return streamtypes.ProcessorIO{
		Type:      publictypes.StreamTypeResponse,
		ReqAction: action,
		Name:      "",
	}, nil
}
