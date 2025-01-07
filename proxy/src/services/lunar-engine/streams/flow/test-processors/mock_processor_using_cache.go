package testprocessors

import (
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
)

const (
	GlobalKeyCacheHit = "cache_hit"

	cacheHitConditionName    = "cacheHit"
	cacheMissedConditionName = "cacheMissed"
)

func NewMockProcessorUsingCache(metadata *streamtypes.ProcessorMetaData) (streamtypes.Processor, error) { //nolint:lll
	return &MockProcessorUsingCache{Name: metadata.Name, Metadata: metadata}, nil
}

type MockProcessorUsingCache struct {
	Name     string
	Metadata *streamtypes.ProcessorMetaData
}

func (p *MockProcessorUsingCache) Execute(
	_ string,
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	err := signInExecution(apiStream, p.Name)
	if err != nil {
		return streamtypes.ProcessorIO{}, err
	}
	cacheHit, err := apiStream.GetContext().GetGlobalContext().Get(GlobalKeyCacheHit)
	if err == nil {
		if cacheHit.(bool) {
			return streamtypes.ProcessorIO{
				Type: publictypes.StreamTypeRequest,
				Name: cacheHitConditionName,
			}, nil
		}
	}
	return streamtypes.ProcessorIO{
		Type: publictypes.StreamTypeRequest,
		Name: cacheMissedConditionName,
	}, nil
}

func (p *MockProcessorUsingCache) GetName() string {
	return p.Name
}

func (p *MockProcessorUsingCache) IsBodyRequired() bool {
	return false
}
