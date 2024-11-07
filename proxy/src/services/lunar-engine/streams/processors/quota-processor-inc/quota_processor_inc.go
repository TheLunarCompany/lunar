package quotaprocessorinc

import (
	"lunar/engine/streams/processors/utils"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
)

const quotaParam = "quota_id"

type quotaProcessorInc struct {
	name     string
	quotaID  string
	metaData *streamtypes.ProcessorMetaData
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

	return proc, nil
}

func (p *quotaProcessorInc) GetName() string {
	return p.name
}

func (p *quotaProcessorInc) Execute(
	_ string,
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	quota, err := p.metaData.Resources.GetQuota(p.quotaID, apiStream.GetID())
	if err != nil {
		return streamtypes.ProcessorIO{}, err
	}

	if err := quota.Inc(apiStream); err != nil {
		return streamtypes.ProcessorIO{}, err
	}

	return streamtypes.ProcessorIO{
		Type: apiStream.GetType(),
		Name: "",
	}, nil
}
