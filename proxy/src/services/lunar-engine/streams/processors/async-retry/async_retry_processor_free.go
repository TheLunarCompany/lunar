//go:build !pro

package processorretry

import (
	"fmt"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
)

type asyncRetryProcessor struct{}

func newProcessor(
	_ *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	return &asyncRetryProcessor{},
		fmt.Errorf("async retry processor is not available in the free version")
}

func (p *asyncRetryProcessor) GetName() string {
	return ""
}

func (p *asyncRetryProcessor) Execute(
	_ string,
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	return streamtypes.ProcessorIO{
		Type: apiStream.GetType(),
	}, nil
}

func (p *asyncRetryProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{}
}
