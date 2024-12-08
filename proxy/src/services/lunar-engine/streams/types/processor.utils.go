package streamtypes

import (
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
