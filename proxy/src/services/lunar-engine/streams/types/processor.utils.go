package streamtypes

import (
	"fmt"
	publictypes "lunar/engine/streams/public-types"
	"lunar/engine/utils"
	"lunar/toolkit-core/clock"
)

func (p *ProcessorIO) IsRequestActionAvailable() bool {
	// return p.ReqAction != nil
	return !utils.IsInterfaceNil(p.ReqAction)
}

func (p *ProcessorIO) IsResponseActionAvailable() bool {
	return p.RespAction != nil
}

func (m *ProcessorMetaData) GetClock() publictypes.ClockI {
	if m.Clock == nil {
		return clock.NewRealClock()
	}
	return m.Clock
}

// CheckCondition checks if the condition is available for the stream type
func (p *ProcessorDefinition) CheckCondition(
	condition string,
	streamType publictypes.StreamType,
) error {
	var validConditions []string
	for _, outputStream := range p.OutputStreams {
		streamTypeToCheck := outputStream.Type
		if streamTypeToCheck == publictypes.StreamTypeAny {
			streamTypeToCheck = streamType
		}
		validConditions = append(validConditions, outputStream.Name)
		if streamTypeToCheck == streamType && outputStream.Name == condition {
			return nil
		}
	}
	return fmt.Errorf("%s condition not found for stream type %v. Valid conditions are: %v",
		condition, streamType, validConditions)
}
