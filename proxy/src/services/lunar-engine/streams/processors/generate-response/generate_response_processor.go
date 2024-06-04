package processorgenerateresponse

import (
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/streams/processors/utils"
	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
)

const (
	defaultStatusCode = 200
	defaultBody       = ""
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
	}

	if err := utils.ExtractNumericParam(metaData.Parameters,
		"status",
		&proc.statusCode); err != nil {
		log.Warn().Err(err).Msg("failed to extract status code, using default")
		proc.statusCode = defaultStatusCode
	}

	if err := utils.ExtractStrParam(metaData.Parameters,
		"body",
		&proc.body); err != nil {
		log.Warn().Err(err).Msg("failed to extract body, using default")
		proc.body = defaultBody
	}

	if err := utils.ExtractMapParam(metaData.Parameters,
		"headers",
		&proc.header); err != nil {
		log.Warn().Err(err).Msg("failed to extract headers, using default")
		proc.header = nil
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
		Type:      streamtypes.StreamTypeResponse,
		ReqAction: &actions.NoOpAction{},
		Name:      "",
	}, nil
}
