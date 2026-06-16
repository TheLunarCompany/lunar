package runner

import (
	"lunar/engine/streams"
	streamconfig "lunar/engine/streams/config"

	"github.com/rs/zerolog/log"

	publictypes "lunar/engine/streams/public-types"
)

func RunFlow(
	stream *streams.Stream,
	apiStream publictypes.APIStreamI,
	actions *streamconfig.StreamActions,
) error {
	err := stream.ExecuteFlow(apiStream, actions)
	if err != nil {
		log.Error().Err(err).Msgf("Failed to execute %v flow %v",
			apiStream.GetType(),
			apiStream.GetName())
		return err
	}
	return nil
}
