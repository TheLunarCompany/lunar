package runner

import (
	"lunar/engine/streams"

	"github.com/rs/zerolog/log"

	publictypes "lunar/engine/streams/public-types"
)

func RunFlow(stream *streams.Stream, apiStream publictypes.APIStreamI) error {
	err := stream.ExecuteFlow(apiStream)
	if err != nil {
		log.Error().Err(err).Msgf("Failed to execute %v flow %v",
			apiStream.GetType(),
			apiStream.GetName())
		return err
	}
	return nil
}
