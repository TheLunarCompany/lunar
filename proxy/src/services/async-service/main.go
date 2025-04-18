package main

import (
	"context"
	"lunar/async-service/runner"
	contextmanager "lunar/toolkit-core/context-manager"
	"lunar/toolkit-core/logging"
	"os"
	"os/signal"
	"syscall"

	"github.com/rs/zerolog/log"
)

func main() {
	ctx, _ := signal.NotifyContext(context.Background(),
		os.Interrupt, os.Kill, syscall.SIGTTIN, syscall.SIGTERM)

	ctxMng := contextmanager.Get().WithContext(ctx)
	clock := ctxMng.GetClock()
	_ = logging.ConfigureLogger("AsyncService", false, clock)

	runner, err := runner.NewRunner()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to initialize runner")
	}

	if err := runner.Run(); err != nil {
		log.Debug().Err(err).Msg("Failed to start runner")
	}
}
