package processorlimiter

import (
	"fmt"
	"lunar/engine/streams/processors/utils"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
)

const (
	quotaIDArg              = "quota_id"
	belowQuotaConditionName = "below_limit"
	aboveQuotaConditionName = "above_limit"
)

type limiterProcessor struct {
	name     string
	quotaID  string
	metaData *streamtypes.ProcessorMetaData
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	processor := &limiterProcessor{
		metaData: metaData,
	}

	if err := utils.ExtractStrParam(metaData.Parameters,
		quotaIDArg,
		&processor.quotaID); err != nil {
		log.Trace().Msgf("quota_id not defined for %v", metaData.Name)
	}

	return processor, nil
}

func (p *limiterProcessor) GetName() string {
	return p.name
}

func (p *limiterProcessor) Execute(
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	if apiStream.GetType() != publictypes.StreamTypeRequest {
		return streamtypes.ProcessorIO{}, fmt.Errorf("invalid stream type: %s", apiStream.GetType())
	}
	quota, err := p.metaData.Resources.GetQuota(p.quotaID, apiStream.GetID())
	if err != nil {
		return streamtypes.ProcessorIO{}, err
	}

	isAllowed, err := quota.Allowed(apiStream)
	if err != nil {
		return streamtypes.ProcessorIO{}, err
	}

	if isAllowed {
		return streamtypes.ProcessorIO{
			Type: apiStream.GetType(),
			Name: belowQuotaConditionName,
		}, nil
	}
	return streamtypes.ProcessorIO{
		Type: apiStream.GetType(),
		Name: aboveQuotaConditionName,
	}, nil
}
