package streamtypes

import "lunar/engine/utils"

func (p *ProcessorIO) IsRequestActionAvailable() bool {
	// return p.ReqAction != nil
	return !utils.IsInterfaceNil(p.ReqAction)
}

func (p *ProcessorIO) IsResponseActionAvailable() bool {
	return p.RespAction != nil
}
