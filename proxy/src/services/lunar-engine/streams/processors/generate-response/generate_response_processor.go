package processorgenerateresponse

import (
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/streams/processors/utils"
	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
)

const (
	statusParam = "status"
	bodyParam   = "body"
)

type generateResponseProcessor struct {
	name       string
	statusCode int
	body       string
	header     map[string]string
	metaData   *streamtypes.ProcessorMetaData
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	proc := &generateResponseProcessor{
		name:     metaData.Name,
		metaData: metaData,
		header:   make(map[string]string),
	}

	// status code
	if err := utils.ExtractNumericParam(metaData.Parameters,
		statusParam,
		&proc.statusCode); err != nil {
		log.Trace().Msgf("status code not defined for %v", metaData.Name)
	}

	// body
	if err := utils.ExtractStrParam(metaData.Parameters,
		bodyParam,
		&proc.body); err != nil {
		log.Trace().Msgf("body not defined for %v", metaData.Name)
	}

	// headers
	if err := utils.ExtractMapFromParams(metaData.Parameters,
		&proc.header,
		statusParam,
		bodyParam); err != nil {
		log.Trace().Msgf("headers not defined for %v", metaData.Name)
	}

	return proc, nil
}

func (p *generateResponseProcessor) GetName() string {
	return p.name
}

func (p *generateResponseProcessor) Execute(
	apiStream *streamtypes.APIStream,
) (streamtypes.ProcessorIO, error) {
	if apiStream.Type == streamtypes.StreamTypeRequest {
		return p.onRequest(apiStream)
	} else if apiStream.Type == streamtypes.StreamTypeResponse {
		return p.onResponse(apiStream)
	}
	return streamtypes.ProcessorIO{}, fmt.Errorf("invalid stream type: %s", apiStream.Type)
}

func (p *generateResponseProcessor) onRequest(
	_ *streamtypes.APIStream,
) (streamtypes.ProcessorIO, error) {
	var action actions.ReqLunarAction = &actions.EarlyResponseAction{
		Status:  p.statusCode,
		Body:    p.body,
		Headers: p.header,
	}

	return streamtypes.ProcessorIO{
		Type:      streamtypes.StreamTypeResponse,
		ReqAction: action,
		Name:      "",
	}, nil
}

func (p *generateResponseProcessor) onResponse(
	_ *streamtypes.APIStream,
) (streamtypes.ProcessorIO, error) {
	return streamtypes.ProcessorIO{
		Type:       streamtypes.StreamTypeResponse,
		RespAction: &actions.NoOpAction{},
		Name:       "",
	}, nil
}
