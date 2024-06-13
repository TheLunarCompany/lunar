package runner

import (
	"lunar/engine/streams"

	"github.com/rs/zerolog/log"

	streamtypes "lunar/engine/streams/types"
)

func RunFlow(stream *streams.Stream, apiStream *streamtypes.APIStream) error {
	err := stream.ExecuteFlow(apiStream)
	if err != nil {
		log.Error().Err(err).Msgf("Failed to execute %v flow %v", apiStream.Type, apiStream.Name)
		return err
	}
	return nil
}
