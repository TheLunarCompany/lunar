package routing

import (
	"encoding/json"
	"fmt"
	"io"
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

func readJSONFile(filePath string) ([]byte, error) {
	content, err := os.ReadFile(filePath)
	if err != nil {
		log.Error().Err(err).Stack().Msgf("Failed to read %s", filePath)
	}
	return content, err
}

func handleJSONResponse(writer http.ResponseWriter, data []byte) {
	writer.Header().Set("Content-Type", "application/json")
	writer.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(writer).Encode(
		map[string]string{"data": string(data)}); err != nil {
		log.Error().Err(err).Stack().Msg("Failed encoding response")
	}
}

func handleError(writer http.ResponseWriter, message string, status int,
	err error,
) {
	http.Error(writer, fmt.Sprintf("%s, err: %v", message, err), status)
	log.Error().Err(err).Stack().Msg(message)
}

func SuccessResponse(writer http.ResponseWriter, message string) {
	log.Info().Msg(message)
	fmt.Fprintf(writer, "%s\n", message)
}

func HandleApplyPolicies(
	policyAccessor *config.TxnPoliciesAccessor,
) func(http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodPost:
			body, err := io.ReadAll(req.Body)
			if err != nil {
				handleError(writer,
					"Error reading request body",
					http.StatusUnprocessableEntity, err)
				return
			}
			defer req.Body.Close()

			if len(body) > 0 {
				err := policyAccessor.UpdateRawData(body)
				if err != nil {
					handleError(writer,
						"Failed to apply policies from file",
						http.StatusUnprocessableEntity, err)
					return
				}
			}

			err = policyAccessor.ReloadFromFile()
			if err != nil {
				handleError(writer,
					"Failed to apply policies from file",
					http.StatusUnprocessableEntity, err)
				return
			}

			SuccessResponse(writer, "✅ Successfully applied policies from file")
		default:
			http.Error(writer, "Unsupported Method", http.StatusMethodNotAllowed)
		}
	}
}

func HandleValidatePolicies() func(http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodPost:
			_, err := config.GetPoliciesConfig()
			if err != nil {
				handleError(writer,
					fmt.Sprintf("Failed to validate policies: %v", err),
					http.StatusUnprocessableEntity, err)
				return
			}
			SuccessResponse(writer, "✅ Successfully validated policies from file")
		default:
			http.Error(writer, "Unsupported Method", http.StatusMethodNotAllowed)
		}
	}
}

func HandleJSONFileRead(location string) func(
	http.ResponseWriter, *http.Request) {
	return func(writer http.ResponseWriter, req *http.Request) {
		switch req.Method {
		case http.MethodGet:
			data, err := readJSONFile(location)
			if err != nil {
				handleError(writer,
					fmt.Sprintf("Failed to read %s: %v", location, err),
					http.StatusUnprocessableEntity, err)
				return
			}
			handleJSONResponse(writer, data)
		default:
			http.Error(writer, "Unsupported Method", http.StatusMethodNotAllowed)
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
			http.Error(writer, "Unsupported Method", http.StatusMethodNotAllowed)
		}
	}
}
