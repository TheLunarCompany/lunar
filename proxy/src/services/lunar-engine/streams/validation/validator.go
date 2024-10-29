package validation

import (
	"fmt"
	"lunar/engine/streams"

	"github.com/rs/zerolog/log"
)

type Validator struct {
	dryRunStream *streams.Stream
}

func NewValidator() *Validator {
	return &Validator{}
}

func (v *Validator) Validate() error {
	stream, err := streams.NewStream()
	if err != nil {
		return fmt.Errorf("failed to create stream: %w", err)
	}
	v.dryRunStream = stream.WithStrictMode()

	log.Info().Msg("Starting flows validation")
	if err := v.dryRunStream.Initialize(); err != nil {
		return fmt.Errorf("failed to initialize streams: %w", err)
	}

	log.Info().Msg("Flows validation completed")
	return nil
}
