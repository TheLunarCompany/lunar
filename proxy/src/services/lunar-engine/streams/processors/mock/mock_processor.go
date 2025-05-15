package processormock

import (
	publictypes "lunar/engine/streams/public-types"
	streamtypes "lunar/engine/streams/types"

	"github.com/rs/zerolog/log"
)

type mockProcessor struct {
	name     string
	arg1     int
	arg2     string
	metaData *streamtypes.ProcessorMetaData
}

func NewProcessor(metaData *streamtypes.ProcessorMetaData) (streamtypes.ProcessorI, error) {
	mockProc := &mockProcessor{
		name:     metaData.Name,
		metaData: metaData,
	}

	if val, ok := metaData.Parameters["arg1"]; ok {
		mockProc.arg1 = val.Value.GetInt()
	}

	if val, ok := metaData.Parameters["arg2"]; ok {
		mockProc.arg2 = val.Value.GetString()
	}

	return mockProc, nil
}

func (p *mockProcessor) Execute(_ string, APIStream publictypes.APIStreamI) (streamtypes.ProcessorIO, error) { //nolint:lll
	log.Info().Int("arg1", p.arg1).Str("arg2", p.arg2).Msgf("Executing mock processor %s", p.name)
	log.Info().Msgf("%s Body: %s", APIStream.GetType().String(), APIStream.GetBody())
	if APIStream.GetType().IsResponseType() {
		log.Info().Msgf("Res Body: %s", APIStream.GetResponse().GetBody())
	} else {
		log.Info().Msgf("Req Body: %s", APIStream.GetRequest().GetBody())
	}
	return streamtypes.ProcessorIO{
		Type: publictypes.StreamTypeAny,
		Name: "",
	}, nil
}

func (p *mockProcessor) GetName() string {
	return p.name
}

func (p *mockProcessor) GetRequirement() *streamtypes.ProcessorRequirement {
	return &streamtypes.ProcessorRequirement{
		IsBodyRequired: true,
	}
}
