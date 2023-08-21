package routing

import (
	"fmt"
	"lunar/engine/config"
	"net/http"

	"github.com/rs/zerolog/log"
)

func HandleApplyPolicies(
	policyAccessor config.PoliciesAccessor,
) func(http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodPost:
			log.Info().Msg("🧪 Attempting to apply policies from file...")
			err := policyAccessor.ReloadFromFile()
			if err != nil {
				http.Error(
					writer,
					fmt.Sprintf(
						"failed applying policies from file, err: %v",
						err,
					),
					http.StatusUnprocessableEntity,
				)
				log.Error().
					Err(err).
					Stack().
					Msg("Failed applying policies from file")
				return
			}
			log.Info().Msg("✅ Successfully applied policies from file")
			fmt.Fprintf(writer, "✅ successfully applied policies from file\n")
		default:
			http.NotFound(writer, req)
		}
	}
}

func HandleValidatePolicies() func(
	http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodPost:
			_, err := config.GetPoliciesConfig()
			if err != nil {
				http.Error(
					writer,
					fmt.Sprint(err),
					http.StatusUnprocessableEntity,
				)
				log.Error().
					Err(err).
					Stack().
					Msg("Failed validating policies from file")
				return
			}
			log.Info().Msg("✅ Successfully validated policies from file")
			fmt.Fprintf(writer, "✅ successfully validated policies from file\n")
		default:
			http.NotFound(writer, req)
		}
	}
}
