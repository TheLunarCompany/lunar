//go:build !pro

package processorasyncqueue

import (
	"fmt"
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"
)

type asyncQueueProcessor struct{}

func newProcessor(
	_ *streamtypes.ProcessorMetaData,
) (streamtypes.ProcessorI, error) {
	return &asyncQueueProcessor{},
		fmt.Errorf("async queue processor is not available in the free version")
}

func (p *asyncQueueProcessor) GetName() string {
	return ""
}

func (p *asyncQueueProcessor) Execute(
	_ string,
	apiStream publictypes.APIStreamI,
) (streamtypes.ProcessorIO, error) {
	return streamtypes.ProcessorIO{
		Type: apiStream.GetType(),
	}, nil
}

func (p *asyncQueueProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{}
}
