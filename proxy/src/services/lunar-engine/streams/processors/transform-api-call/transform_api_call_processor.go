package transformapicall

import (
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/streams/processors/utils"
	public_types "lunar/engine/streams/public-types"

	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
)

const (
	setParam       = "set"
	addParam       = "add"
	deleteParam    = "delete"
	obfuscateParam = "obfuscate"
)

type transformAPICallProcessor struct {
	name           string
	transformation *transformer
	metaData       *streamtypes.ProcessorMetaData
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	processor := transformAPICallProcessor{
		name:           metaData.Name,
		metaData:       metaData,
		transformation: newTransformer(),
	}

	if err := processor.init(); err != nil {
		return nil, err
	}

	return &processor, nil
}

func (p *transformAPICallProcessor) GetName() string {
	return p.name
}

func (p *transformAPICallProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{
		IsBodyRequired: true,
	}
}

func (p *transformAPICallProcessor) Execute(
	_ string,
	apiStream public_types.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	var err error
	var reqAction actions.ReqLunarAction
	var respAction actions.RespLunarAction
	if apiStream.GetType() == public_types.StreamTypeRequest {
		reqAction, err = p.transformation.OnRequest(apiStream)
	} else {
		respAction, err = p.transformation.OnResponse(apiStream)
	}

	if err != nil {
		log.Trace().Err(err).Msgf("failed to transform %v", apiStream.GetType())
		return streamtypes.ProcessorIO{
			Type:      apiStream.GetType(),
			ReqAction: &actions.NoOpAction{},
			Failure:   true,
		}, nil
	}

	return streamtypes.ProcessorIO{
		Type:       apiStream.GetType(),
		ReqAction:  reqAction,
		RespAction: respAction,
	}, nil
}

func (p *transformAPICallProcessor) init() error {
	if err := utils.ExtractMapOfAnyParam(p.metaData.Parameters,
		setParam,
		p.transformation.setDefinitions); err != nil || len(p.transformation.setDefinitions) == 0 {
		log.Trace().Msgf("No %s parameter found", setParam)
	}

	if err := utils.ExtractListOfStringParam(p.metaData.Parameters,
		deleteParam,
		&p.transformation.deleteDefinitions); err != nil || len(p.transformation.deleteDefinitions) == 0 {
		log.Trace().Msgf("No %s parameter found", deleteParam)
	}

	if err := utils.ExtractListOfStringParam(p.metaData.Parameters,
		obfuscateParam,
		&p.transformation.obfuscateDefinitions); err != nil ||
		len(p.transformation.obfuscateDefinitions) == 0 {
		log.Trace().Msgf("No %s parameter found", obfuscateParam)
	}

	if !p.transformation.IsTransformationsDefined() {
		return fmt.Errorf("no transformations found")
	}

	return nil
}
