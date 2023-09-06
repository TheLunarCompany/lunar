package routing

import (
	"encoding/json"
	"fmt"
	"lunar/engine/config"
	"net/http"
	"os"

	"github.com/rs/zerolog/log"
)

const (
	managedKey string = "LUNAR_MANAGED"
)

var (
	managedValue = os.Getenv(managedKey)
	managed      = isManaged()
)

func isManaged() bool {
	return managedValue == "true"
}

type handshake struct {
	Managed bool `json:"managed"`
}

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

func HandleHandshake() func(
	http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodGet:
			writer.Header().Set("Content-Type", "application/json")
			writer.WriteHeader(http.StatusOK)
			log.Info().Msg("✅ Handshake successful.")
			err := json.NewEncoder(writer).Encode(&handshake{Managed: managed})
			if err != nil {
				log.Error().Err(err).Stack().Msg("Failed encoding response")
			}
		default:
			http.NotFound(writer, req)
		}
	}
}
