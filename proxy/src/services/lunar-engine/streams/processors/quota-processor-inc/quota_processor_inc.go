package quotaprocessorinc

import (
	"lunar/engine/streams/processors/utils"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
)

const (
	quotaParam      = "quota_id"
	applyLogicParam = "should_apply_logic"
)

type quotaProcessorInc struct {
	name       string
	applyLogic bool
	quotaID    string
	metaData   *streamtypes.ProcessorMetaData
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	proc := &quotaProcessorInc{
		name:     metaData.Name,
		metaData: metaData,
	}
	log.Trace().Msgf("quotaProcessorInc Params: %v", metaData.Parameters)
	if err := utils.ExtractStrParam(metaData.Parameters,
		quotaParam,
		&proc.quotaID); err != nil {
		log.Trace().Msgf("quotaID not defined for %v", metaData.Name)
	}

	if err := utils.ExtractBoolParam(metaData.Parameters,
		applyLogicParam,
		&proc.applyLogic); err != nil {
		log.Trace().Msgf("should_apply_logic not defined for %v", metaData.Name)
	}

	return proc, nil
}

func (p *quotaProcessorInc) GetName() string {
	return p.name
}

func (p *quotaProcessorInc) Execute(
	_ string,
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	if p.applyLogic {
		quota, err := p.metaData.Resources.GetQuota(p.quotaID, apiStream.GetID())
		if err != nil {
			return streamtypes.ProcessorIO{}, err
		}

		if err := quota.Inc(apiStream); err != nil {
			return streamtypes.ProcessorIO{}, err
		}
	} else {
		log.Trace().Msgf("quotaProcessorInc::logic not applied for %v", p.name)
	}

	return streamtypes.ProcessorIO{
		Type: apiStream.GetType(),
		Name: "",
	}, nil
}

func (p *quotaProcessorInc) IsBodyRequired() bool {
	return false
}
