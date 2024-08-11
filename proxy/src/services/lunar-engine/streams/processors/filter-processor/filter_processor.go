package filterprocessor

import (
	"fmt"
	"lunar/engine/actions"
	"lunar/engine/streams/processors/utils"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
)

const (
	HitConditionName  = "hit"
	MissConditionName = "miss"

	URLParam      = "url"
	EndpointParam = "endpoint"
	MethodParam   = "method"
	BodyParam     = "body"
	HeaderParam   = "header"
)

type filterProcessor struct {
	name        string
	url         string
	endpoint    string
	method      string
	body        string
	headerKey   string
	headerValue string
	metaData    *streamtypes.ProcessorMetaData
}

func NewProcessor(
	metaData *streamtypes.ProcessorMetaData,
) (streamtypes.Processor, error) {
	proc := &filterProcessor{
		name:     metaData.Name,
		metaData: metaData,
	}

	if err := proc.init(metaData); err != nil {
		return nil, err
	}

	return proc, nil
}

func (p *filterProcessor) GetName() string {
	return p.name
}

func (p *filterProcessor) Execute(
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	checkCondition := func(conditions map[string]string, filterField string, apiField func() string) {
		if filterField == "" {
			return
		}
		if filterField == apiField() {
			conditions[HitConditionName] = filterField
		} else {
			conditions[MissConditionName] = filterField
		}
	}
	conditions := make(map[string]string)
	checkCondition(conditions, p.url, apiStream.GetURL)
	checkCondition(conditions, p.method, apiStream.GetMethod)
	checkCondition(conditions, p.body, apiStream.GetBody)

	if p.headerKey != "" && p.headerValue != "" {
		if apiStream.DoesHeaderValueMatch(p.headerKey, p.headerValue) {
			conditions[HitConditionName] = p.headerKey
		} else {
			conditions[MissConditionName] = p.headerKey
		}
	}

	condition := HitConditionName
	if field, ok := conditions[MissConditionName]; ok {
		condition = MissConditionName
		log.Trace().Msgf("condition %v failed for %v", field, p.metaData.Name)
	}

	return streamtypes.ProcessorIO{
		Type:      apiStream.GetType(),
		ReqAction: &actions.NoOpAction{},
		Name:      condition,
	}, nil
}

func (p *filterProcessor) init(metaData *streamtypes.ProcessorMetaData) error {
	if err := utils.ExtractStrParam(metaData.Parameters,
		URLParam,
		&p.url); err != nil {
		log.Trace().Msgf("url not defined for %v", metaData.Name)
	}

	if err := utils.ExtractStrParam(metaData.Parameters,
		EndpointParam,
		&p.endpoint); err != nil {
		log.Trace().Msgf("endpoint not defined for %v", metaData.Name)
	}

	if err := utils.ExtractStrParam(metaData.Parameters,
		MethodParam,
		&p.method); err != nil {
		log.Trace().Msgf("method not defined for %v", metaData.Name)
	}

	if err := utils.ExtractStrParam(metaData.Parameters,
		BodyParam,
		&p.body); err != nil {
		log.Trace().Msgf("body not defined for %v", metaData.Name)
	}

	var keyValParam string
	if err := utils.ExtractStrParam(metaData.Parameters,
		HeaderParam,
		&keyValParam); err != nil {
		log.Trace().Msgf("header not defined for %v", metaData.Name)
	} else {
		p.headerKey, p.headerValue = utils.ExtractKeyValuePair(keyValParam)
	}

	if p.url == "" && p.endpoint == "" && p.method == "" && p.body == "" && p.headerKey == "" {
		return fmt.Errorf("no filter criteria defined for %v", metaData.Name)
	}
	return nil
}
